// app/api/cafeteria-reservations/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

// --- Database connection pool (same as before) ---
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

// --- TokenPayload interface (same as before) ---
interface TokenPayload {
  studentId: string; // This should be the UUID
  email: string;
  studentIdNo: number; // Assuming you included this in your JWT payload
  // iat and exp are automatically added by jsonwebtoken
  iat?: number;
  exp?: number;
}

// --- ReservationRequestBody interface (for POST, same as before) ---
interface ReservationRequestBody {
  reservation_date: string;
  meal_type: string;
}


// --- POST handler (for creating reservations - same as before) ---
export async function POST(request: NextRequest) {
  // ... your existing POST logic for creating a reservation ...
  // (Make sure it's complete and working as per our last discussion)

  // For brevity, I'm not pasting the full POST handler again here,
  // but it should be the one that successfully created a reservation for you.
  // The following is a placeholder reminder:

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
      decodedPayload = jwt.verify(token, JWT_SECRET) as TokenPayload;
    } catch (err) {
      return NextResponse.json({ error: 'Invalid or expired session.' }, { status: 401 });
    }
    const studentId = decodedPayload.studentId;
    if (!studentId) return NextResponse.json({ error: 'Invalid token: Student ID missing.' }, { status: 400 });

    let body: ReservationRequestBody;
    try {
      body = await request.json();
    } catch (parseError) {
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
  } catch (error: any) {
    console.error('💥 Create Reservation API Error:', error);
    if (error.code === '23505') return NextResponse.json({ error: 'This reservation already exists or conflicts.' }, { status: 409 });
    return NextResponse.json({ error: 'Failed to create reservation.' }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}


// --- NEW GET handler (for viewing own reservations) ---
export async function GET(request: NextRequest) {
  if (!JWT_SECRET) {
    console.error('💥 View Reservations API Error: JWT_SECRET is not available.');
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
  }
  if (!process.env.DATABASE_URL) {
    console.error('💥 View Reservations API Error: DATABASE_URL is not available.');
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
  }

  let client;

  try {
    // 1. Authenticate the user (same logic as POST and other authenticated GETs)
    const tokenCookie = request.cookies.get('authToken');
    const token = tokenCookie?.value;

    if (!token) {
      return NextResponse.json({ error: 'Authentication required. Please login.' }, { status: 401 });
    }

    let decodedPayload: TokenPayload;
    try {
      decodedPayload = jwt.verify(token, JWT_SECRET) as TokenPayload;
    } catch (err: any) {
      console.error('❌ Invalid or expired token for viewing reservations:', err.message);
      return NextResponse.json({ error: 'Invalid or expired session. Please login again.' }, { status: 401 });
    }

    const studentId = decodedPayload.studentId; // This is the UUID from students.id
    if (!studentId) {
      return NextResponse.json({ error: 'Invalid token: Student ID missing.' }, { status: 400 });
    }

    console.log(`🔍 Fetching reservations for studentId: ${studentId}`);

    // 2. Connect to the database
    try {
      client = await pool.connect();
    } catch (connectionError: any) {
      console.error('❌ Database connection failed for viewing reservations:', connectionError);
      return NextResponse.json({ error: 'Database connection failed.' }, { status: 503 });
    }

    // 3. Query the cafeteria_reservations table for the student's reservations
    // You might want to order them, e.g., by reservation_date descending (most recent first)
    // Or by reservation_date ascending for upcoming.
    // You could also filter by status (e.g., only 'active') or date range in the future.
    const queryText = `
      SELECT id, student_id, reservation_date, meal_type, status
      FROM cafeteria_reservations
      WHERE student_id = $1
      ORDER BY reservation_date DESC, meal_type ASC; 
    `;
    // Example: ORDER BY reservation_date DESC (most recent/upcoming date first) then by meal_type

    const result = await client.query(queryText, [studentId]);
    const reservations = result.rows;

    console.log(`📊 Found ${reservations.length} reservations for studentId: ${studentId}`);

    return NextResponse.json({
      success: true,
      count: reservations.length,
      data: reservations
    }, { status: 200 });

  } catch (error: any) {
    console.error('💥 View Reservations API Error:', error);
    if (error.stack) {
      console.error(error.stack);
    }
    return NextResponse.json({ error: 'Failed to fetch reservations.' }, { status: 500 });
  } finally {
    if (client) {
      client.release();
      console.log('🔓 Database connection released for viewing reservations');
    }
  }
}