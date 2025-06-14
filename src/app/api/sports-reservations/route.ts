// app/api/sports-reservations/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { Pool, DatabaseError } from 'pg';
import jwt, { JwtPayload } from 'jsonwebtoken';

// --- Database connection pool ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

const JWT_SECRET = process.env.JWT_SECRET;

// --- Type Interfaces ---
interface TokenPayload extends JwtPayload {
  studentId: string;
}

// FIX: Updated request body to expect facility_id (a number)
interface SportsReservationRequestBody {
  facility_id: number;
  reservation_start_time: string; // e.g., "2025-06-20T14:00:00+03:00"
  reservation_end_time: string;
}

// You can keep the existing GET handler in this file.
// I am only providing the updated POST handler below.

export async function POST(request: NextRequest) {
  if (!JWT_SECRET || !process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
  }

  let client;
  try {
    // 1. Authenticate user
    const tokenCookie = request.cookies.get('authToken');
    const token = tokenCookie?.value;
    if (!token) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    let decodedPayload: TokenPayload;
    try {
      const verified = jwt.verify(token, JWT_SECRET);
      if (typeof verified === 'string') throw new Error("Invalid token payload");
      decodedPayload = verified as TokenPayload;
    } catch {
      return NextResponse.json({ error: 'Invalid or expired session.' }, { status: 401 });
    }
    const studentId = decodedPayload.studentId;
    if (!studentId) {
      return NextResponse.json({ error: 'Invalid token: Student ID missing.' }, { status: 400 });
    }

    // 2. Get and validate request body
    const body: SportsReservationRequestBody = await request.json();
    
    // FIX: Updated destructuring and validation to use facility_id
    const { facility_id, reservation_start_time, reservation_end_time } = body;

    if (!facility_id || !reservation_start_time || !reservation_end_time || typeof facility_id !== 'number') {
      return NextResponse.json({ error: 'Missing or invalid required fields. Expecting facility_id (number) and start/end times.' }, { status: 400 });
    }

    try {
        if (new Date(reservation_start_time) >= new Date(reservation_end_time)) {
             return NextResponse.json({ error: 'reservation_end_time must be after reservation_start_time.' }, { status: 400 });
        }
    } catch {
        return NextResponse.json({ error: 'Invalid date format for reservation times. Use ISO 8601 format.' }, { status: 400 });
    }
    
    const defaultStatus = "confirmed";
    client = await pool.connect();
    
    // FIX: Updated INSERT query to use facility_id
    const queryText = `
      INSERT INTO sports_reservations (student_id, facility_id, reservation_start_time, reservation_end_time, status)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;

    const result = await client.query(queryText, [
      studentId,
      facility_id,
      reservation_start_time,
      reservation_end_time,
      defaultStatus
    ]);
    const newReservation = result.rows[0];

    return NextResponse.json({
      success: true,
      message: 'Sports reservation created successfully.',
      data: newReservation
    }, { status: 201 });

  } catch (error: unknown) {
    console.error('💥 Create Sports Reservation API Error:', error);
    if (error instanceof DatabaseError) {
        if (error.code === '23505') return NextResponse.json({ error: 'This facility is already booked for the selected time slot.' }, { status: 409 });
        if (error.code === '22007' || error.code === '22008') return NextResponse.json({ error: 'Invalid date/time format provided.' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create sports reservation.' }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
