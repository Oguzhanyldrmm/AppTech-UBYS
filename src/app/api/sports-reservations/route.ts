// app/api/sports-reservations/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

// --- Database connection pool (same as before) ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

const JWT_SECRET = process.env.JWT_SECRET;

// --- TokenPayload interface (same as before) ---
interface TokenPayload {
  studentId: string;
  email: string;
  studentIdNo: number;
  iat?: number;
  exp?: number;
}

// --- SportsReservationRequestBody interface (for POST, same as before) ---
interface SportsReservationRequestBody {
  facility_type: string;
  reservation_start_time: string;
  reservation_end_time: string;
}

// --- POST handler (for creating sports reservations - from previous step) ---
export async function POST(request: NextRequest) {
  // ... your existing, working POST logic for creating a sports reservation ...
  // For brevity, I'm not pasting the full POST handler again here.
  // Ensure it's the one that successfully created a sports reservation for you.
  // Placeholder reminder:
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
      decodedPayload = jwt.verify(token, JWT_SECRET) as TokenPayload;
    } catch (err) {
      return NextResponse.json({ error: 'Invalid or expired session.' }, { status: 401 });
    }
    const studentId = decodedPayload.studentId;
    if (!studentId) return NextResponse.json({ error: 'Invalid token: Student ID missing.' }, { status: 400 });

    const body: SportsReservationRequestBody = await request.json();
    const { facility_type, reservation_start_time, reservation_end_time } = body;

    if (!facility_type || !reservation_start_time || !reservation_end_time || typeof facility_type !== 'string' || facility_type.trim() === '') {
      return NextResponse.json({ error: 'Missing or invalid required fields.' }, { status: 400 });
    }
     try {
        new Date(reservation_start_time).toISOString(); // Validate start time
        new Date(reservation_end_time).toISOString();   // Validate end time
        if (new Date(reservation_start_time) >= new Date(reservation_end_time)) {
             return NextResponse.json({ error: 'reservation_end_time must be after reservation_start_time.' }, { status: 400 });
        }
    } catch (dateError) {
        return NextResponse.json({ error: 'Invalid date format for reservation times. Use ISO 8601 format.' }, { status: 400 });
    }
    const defaultStatus = "confirmed";
    client = await pool.connect();
    const queryText = `
      INSERT INTO sports_reservations (student_id, facility_type, reservation_start_time, reservation_end_time, status)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, student_id, facility_type, reservation_start_time, reservation_end_time, status;
    `;
    const result = await client.query(queryText, [studentId, facility_type, reservation_start_time, reservation_end_time, defaultStatus]);
    const newReservation = result.rows[0];
    return NextResponse.json({ success: true, message: 'Sports reservation created successfully.', data: newReservation }, { status: 201 });
  } catch (error: any) {
    console.error('💥 Create Sports Reservation API Error:', error);
    if (error.code === '23505') return NextResponse.json({ error: 'This facility is already booked for the selected time slot or conflicts.' }, { status: 409 });
    if (error.code === '22007' || error.code === '22008') return NextResponse.json({ error: 'Invalid date/time format or value for reservation times.' }, { status: 400 });
    return NextResponse.json({ error: 'Failed to create sports reservation.' }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}


// --- NEW GET handler (for viewing own sports reservations) ---
export async function GET(request: NextRequest) {
  if (!JWT_SECRET) {
    console.error('💥 View Sports Reservations API Error: JWT_SECRET is not available.');
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
  }
  if (!process.env.DATABASE_URL) {
    console.error('💥 View Sports Reservations API Error: DATABASE_URL is not available.');
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
  }

  let client;
  try {
    // 1. Authenticate the user
    const tokenCookie = request.cookies.get('authToken');
    const token = tokenCookie?.value;
    if (!token) {
      return NextResponse.json({ error: 'Authentication required. Please login.' }, { status: 401 });
    }

    let decodedPayload: TokenPayload;
    try {
      decodedPayload = jwt.verify(token, JWT_SECRET) as TokenPayload;
    } catch (err: any) {
      console.error('❌ Invalid or expired token for viewing sports reservations:', err.message);
      return NextResponse.json({ error: 'Invalid or expired session. Please login again.' }, { status: 401 });
    }

    const studentId = decodedPayload.studentId;
    if (!studentId) {
      return NextResponse.json({ error: 'Invalid token: Student ID missing.' }, { status: 400 });
    }

    console.log(`🔍 Fetching sports reservations for studentId: ${studentId}`);

    // 2. Connect to database
    client = await pool.connect();

    // 3. Query the sports_reservations table for the student's reservations
    // Order by start time, most recent/upcoming first.
    const queryText = `
      SELECT id, student_id, facility_type, reservation_start_time, reservation_end_time, status
      FROM sports_reservations
      WHERE student_id = $1
      ORDER BY reservation_start_time DESC; 
    `;

    const result = await client.query(queryText, [studentId]);
    const reservations = result.rows;

    console.log(`📊 Found ${reservations.length} sports reservations for studentId: ${studentId}`);

    return NextResponse.json({
      success: true,
      count: reservations.length,
      data: reservations
    }, { status: 200 });

  } catch (error: any) {
    console.error('💥 View Sports Reservations API Error:', error);
    if (error.stack) {
      console.error(error.stack);
    }
    return NextResponse.json({ error: 'Failed to fetch sports reservations.' }, { status: 500 });
  } finally {
    if (client) {
      client.release();
      console.log('🔓 Database connection released for viewing sports reservations');
    }
  }
}