// src/app/api/cafeteria-reservations/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { Pool, DatabaseError } from 'pg';
import jwt, { JwtPayload } from 'jsonwebtoken';

// --- Database connection pool ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

const JWT_SECRET = process.env.JWT_SECRET;

// --- A more specific TokenPayload interface ---
interface TokenPayload extends JwtPayload {
  studentId: string;
  email: string;
  studentIdNo: number;
}

// --- ReservationRequestBody interface (for POST) ---
interface ReservationRequestBody {
  reservation_date: string;
  meal_type: string;
}

// --- POST handler (for creating reservations) ---
export async function POST(request: NextRequest) {
  if (!JWT_SECRET || !process.env.DATABASE_URL) {
    console.error('💥 Create Reservation API Error: Server misconfiguration.');
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
      if (typeof verified === 'string') {
        throw new Error("Invalid token payload format");
      }
      decodedPayload = verified as TokenPayload;
    } catch { // FIX: Variable is completely removed here
      return NextResponse.json({ error: 'Invalid or expired session.' }, { status: 401 });
    }
    const studentId = decodedPayload.studentId;
    if (!studentId) return NextResponse.json({ error: 'Invalid token: Student ID missing.' }, { status: 400 });

    let body: ReservationRequestBody;
    try {
      body = await request.json();
    } catch { // FIX: Variable is completely removed here
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }
    const { reservation_date, meal_type } = body;
    if (!reservation_date || !meal_type || typeof reservation_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(reservation_date) || typeof meal_type !== 'string' || meal_type.trim() === '') {
      return NextResponse.json({ error: 'Missing or invalid required fields.' }, { status: 400 });
    }
    const defaultStatus = "active";
    client = await pool.connect();
    const queryText = `
      INSERT INTO cafeteria_reservations (student_id, reservation_date, meal_type, status)
      VALUES ($1, $2, $3, $4)
      RETURNING id, student_id, reservation_date, meal_type, status;
    `;
    const result = await client.query(queryText, [studentId, reservation_date, meal_type, defaultStatus]);
    const newReservation = result.rows[0];
    return NextResponse.json({ success: true, message: 'Reservation created successfully.', data: newReservation }, { status: 201 });
  } catch (error: unknown) {
    console.error('💥 Create Reservation API Error:', error);
    if (error instanceof DatabaseError && error.code === '23505') {
        return NextResponse.json({ error: 'This reservation already exists or conflicts with another.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create reservation.' }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

// --- GET handler (for viewing own reservations) ---
export async function GET(request: NextRequest) {
  if (!JWT_SECRET || !process.env.DATABASE_URL) {
    console.error('💥 View Reservations API Error: Server misconfiguration.');
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
       if (typeof verified === 'string') {
        throw new Error("Invalid token payload format");
      }
      decodedPayload = verified as TokenPayload;
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error('❌ Invalid or expired token for viewing reservations:', err.message);
      } else {
        console.error('❌ An unknown token verification error occurred:', err);
      }
      return NextResponse.json({ error: 'Invalid or expired session. Please login again.' }, { status: 401 });
    }

    const studentId = decodedPayload.studentId;
    if (!studentId) {
      return NextResponse.json({ error: 'Invalid token: Student ID missing.' }, { status: 400 });
    }
    console.log(`🔍 Fetching reservations for studentId: ${studentId}`);

    try {
      client = await pool.connect();
    } catch (connectionError: unknown) {
      console.error('❌ Database connection failed for viewing reservations:', connectionError);
      return NextResponse.json({ error: 'Database connection failed.' }, { status: 503 });
    }

    const queryText = `
      SELECT id, student_id, reservation_date, meal_type, status
      FROM cafeteria_reservations
      WHERE student_id = $1
      ORDER BY reservation_date DESC, meal_type ASC; 
    `;
    const result = await client.query(queryText, [studentId]);
    const reservations = result.rows;
    console.log(`📊 Found ${reservations.length} reservations for studentId: ${studentId}`);

    return NextResponse.json({
      success: true,
      count: reservations.length,
      data: reservations
    }, { status: 200 });

  } catch (error: unknown) {
    console.error('💥 View Reservations API Error:', error);
    if (error instanceof Error) {
      console.error(error.stack);
    }
    return NextResponse.json({ error: 'Failed to fetch reservations.' }, { status: 500 });
  } finally {
    if (client) {
      try {
        client.release();
        console.log('🔓 Database connection released for viewing reservations');
      } catch (releaseError: unknown) {
        console.error('Error releasing database client:', releaseError);
      }
    }
  }
}