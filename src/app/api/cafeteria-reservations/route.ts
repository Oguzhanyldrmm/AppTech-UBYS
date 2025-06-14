// app/api/cafeteria-reservations/route.ts

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

// --- Type Interfaces ---
interface TokenPayload extends JwtPayload {
  studentId: string;
}

// FIX: Updated request body to expect meal_type_id (a number)
interface ReservationRequestBody {
  reservation_date: string; // e.g., "YYYY-MM-DD"
  meal_type_id: number;
}

// FIX: Updated response shape for viewing reservations
interface ReservationDetails {
    id: string; // uuid
    student_id: string; // uuid
    reservation_date: Date;
    status: string;
    meal_type_id: number;
    meal_name: string; // from the joined table
}

// --- POST handler (for creating reservations) ---
export async function POST(request: NextRequest) {
  if (!JWT_SECRET || !process.env.DATABASE_URL) {
    console.error('💥 Create Cafeteria Reservation API Error: Server misconfiguration.');
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

    let body: ReservationRequestBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }
    
    const { reservation_date, meal_type_id } = body;
    if (!reservation_date || !meal_type_id || typeof reservation_date !== 'string' || typeof meal_type_id !== 'number') {
      return NextResponse.json({ error: 'Missing or invalid required fields: reservation_date (string) and meal_type_id (number) are required.' }, { status: 400 });
    }
    
    client = await pool.connect();
    
    const queryText = `
      INSERT INTO cafeteria_reservations (student_id, reservation_date, meal_type_id, status)
      VALUES ($1, $2, $3, 'active')
      RETURNING *;
    `;
    const result = await client.query(queryText, [studentId, reservation_date, meal_type_id]);
    
    return NextResponse.json({ success: true, message: 'Reservation created successfully.', data: result.rows[0] }, { status: 201 });

  } catch (error: unknown) {
    console.error('💥 Create Cafeteria Reservation API Error:', error);
    if (error instanceof DatabaseError && error.code === '23505') {
        return NextResponse.json({ error: 'This reservation already exists or conflicts.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create reservation.' }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

// --- GET handler (for viewing own reservations) ---
export async function GET(request: NextRequest) {
  if (!JWT_SECRET || !process.env.DATABASE_URL) {
    console.error('💥 View Cafeteria Reservations API Error: Server misconfiguration.');
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
  }
  let client;
  try {
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
    } catch (err: unknown) {
      if (err instanceof Error) console.error('Token verification error:', err.message);
      return NextResponse.json({ error: 'Invalid or expired session.' }, { status: 401 });
    }

    const studentId = decodedPayload.studentId;
    if (!studentId) {
      return NextResponse.json({ error: 'Invalid token payload.' }, { status: 400 });
    }
    
    client = await pool.connect();
    
    // FIX: Updated query to JOIN with the correct 'meal_types' table name
    const queryText = `
      SELECT
        res.id,
        res.student_id,
        res.reservation_date,
        res.status,
        res.meal_type_id,
        mt.name AS meal_name
      FROM
        cafeteria_reservations res
      JOIN
        meal_types mt ON res.meal_type_id = mt.id
      WHERE
        res.student_id = $1
      ORDER BY
        res.reservation_date DESC;
    `;
    const result = await client.query<ReservationDetails>(queryText, [studentId]);
    
    return NextResponse.json({ success: true, count: result.rows.length, data: result.rows });

  } catch (error: unknown) {
    console.error('💥 View Cafeteria Reservations API Error:', error);
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
