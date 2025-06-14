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

interface SportsReservationRequestBody {
  facility_id: number;
  reservation_start_time: string;
  reservation_end_time: string;
}

// FIX: New interface for the detailed reservation data we will return
interface ReservationDetails {
    id: string; // reservation id
    status: string;
    reservation_start_time: Date;
    reservation_end_time: Date;
    facility_id: number;
    facility_name: string;
    facility_location: string;
    facility_type: string;
}


// --- POST handler (This one is already working correctly) ---
export async function POST(request: NextRequest) {
  // ... your existing, working POST logic ...
  // This function does not need to be changed.
  if (!JWT_SECRET || !process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
  }
  let client;
  try {
    const tokenCookie = request.cookies.get('authToken');
    const token = tokenCookie?.value;
    if (!token) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    let decodedPayload: TokenPayload;
    try {
      const verified = jwt.verify(token, JWT_SECRET);
      if (typeof verified === 'string') throw new Error("Invalid token payload");
      decodedPayload = verified as TokenPayload;
    } catch {
      return NextResponse.json({ error: 'Invalid or expired session.' }, { status: 401 });
    }
    const studentId = decodedPayload.studentId;
    if (!studentId) return NextResponse.json({ error: 'Invalid token: Student ID missing.' }, { status: 400 });
    const body: SportsReservationRequestBody = await request.json();
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
    const queryText = `
      INSERT INTO sports_reservations (student_id, facility_id, reservation_start_time, reservation_end_time, status)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const result = await client.query(queryText, [studentId, facility_id, reservation_start_time, reservation_end_time, defaultStatus]);
    return NextResponse.json({ success: true, message: 'Sports reservation created successfully.', data: result.rows[0] }, { status: 201 });
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

// --- UPDATED GET handler (for viewing own reservations) ---
export async function GET(request: NextRequest) {
  if (!JWT_SECRET || !process.env.DATABASE_URL) {
    console.error('💥 View Sports Reservations API Error: Server misconfiguration.');
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
  }
  let client;
  try {
    const tokenCookie = request.cookies.get('authToken');
    const token = tokenCookie?.value;
    if (!token) {
      return NextResponse.json({ error: 'Authentication required. Please login.' }, { status: 401 });
    }

    let decodedPayload: TokenPayload;
    try {
      const verified = jwt.verify(token, JWT_SECRET);
      if (typeof verified === 'string') throw new Error("Invalid token payload");
      decodedPayload = verified as TokenPayload;
    } catch (err: unknown) {
      if (err instanceof Error) console.error('Token verification error:', err.message);
      return NextResponse.json({ error: 'Invalid or expired session.' }, { status: 401 });
    }

    const studentId = decodedPayload.studentId;
    if (!studentId) {
      return NextResponse.json({ error: 'Invalid token payload.' }, { status: 400 });
    }

    client = await pool.connect();

    // FIX: Updated query to JOIN all three tables to get detailed reservation info
    const queryText = `
      SELECT
        res.id,
        res.status,
        res.reservation_start_time,
        res.reservation_end_time,
        sf.id AS facility_id,
        sf.name AS facility_name,
        sf.location_details,
        sft.name AS facility_type
      FROM
        sports_reservations res
      JOIN
        sports_facilities sf ON res.facility_id = sf.id
      JOIN
        sports_facility_types sft ON sf.facility_type_id = sft.id
      WHERE
        res.student_id = $1
      ORDER BY
        res.reservation_start_time DESC;
    `;
    const result = await client.query<ReservationDetails>(queryText, [studentId]);
    
    return NextResponse.json({ success: true, count: result.rows.length, data: result.rows });

  } catch (error: unknown) {
    console.error('💥 View Sports Reservations API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch reservations.' }, { status: 500 });
  } finally {
    if (client) {
      try {
        client.release();
      } catch (releaseError: unknown) {
        console.error('Error releasing client:', releaseError);
      }
    }
  }
}
