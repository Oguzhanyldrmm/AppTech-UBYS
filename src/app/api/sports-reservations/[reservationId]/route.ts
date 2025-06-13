// app/api/sports-reservations/[reservationId]/route.ts

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

// --- TokenPayload interface ---
interface TokenPayload extends JwtPayload {
  studentId: string;
  email: string;
  studentIdNo: number;
}

// FIX: Updated function signature for Next.js 15
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ reservationId: string }> }
): Promise<NextResponse> {
  if (!JWT_SECRET) {
    console.error('💥 Cancel Sports Reservation API Error: JWT_SECRET is not available.');
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
  }
  if (!process.env.DATABASE_URL) {
    console.error('💥 Cancel Sports Reservation API Error: DATABASE_URL is not available.');
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
  }

  // FIX: Await the params Promise
  const { reservationId } = await context.params;

  if (!reservationId || typeof reservationId !== 'string') {
    return NextResponse.json({ error: 'Invalid reservation ID.' }, { status: 400 });
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
      const verified = jwt.verify(token, JWT_SECRET);
      if (typeof verified === 'string') {
        throw new Error("Invalid token payload format");
      }
      decodedPayload = verified as TokenPayload;
    } catch (_err: unknown) { // FIX: Use underscore prefix
      if (_err instanceof Error) {
        console.error('❌ Invalid or expired token for cancelling sports reservation:', _err.message);
        if (_err.name === 'TokenExpiredError') {
          return NextResponse.json({ error: 'Session expired. Please login again.' }, { status: 401 });
        }
      } else {
        console.error('❌ An unknown token verification error occurred:', _err);
      }
      return NextResponse.json({ error: 'Invalid or expired session. Please login again.' }, { status: 401 });
    }

    const studentId = decodedPayload.studentId;
    if (!studentId) {
      return NextResponse.json({ error: 'Invalid token: Student ID missing.' }, { status: 400 });
    }

    console.log(`Attempting to cancel sports reservationId: ${reservationId} for studentId: ${studentId}`);

    // 2. Connect to the database
    try {
      client = await pool.connect();
    } catch (_connectionError: unknown) { // FIX: Use underscore prefix
      console.error('❌ Database connection failed for cancelling sports reservation:', _connectionError);
      return NextResponse.json({ error: 'Database connection failed.' }, { status: 503 });
    }

    // 3. Update the reservation status to "cancelled"
    const newStatus = "cancelled";
    const cancellableStatus = "active";
    const queryText = `
      UPDATE sports_reservations
      SET status = $1
      WHERE id = $2 AND student_id = $3 AND status = $4
      RETURNING id, student_id, reservation_date, facility, time_slot, status;
    `;

    const result = await client.query(queryText, [newStatus, reservationId, studentId, cancellableStatus]);

    if (result.rowCount === 0) {
      const checkQuery = 'SELECT student_id, status FROM sports_reservations WHERE id = $1';
      const checkResult = await client.query(checkQuery, [reservationId]);

      if (checkResult.rowCount === 0) {
        return NextResponse.json({ error: 'Sports reservation not found.' }, { status: 404 });
      }
      if (checkResult.rows[0].student_id !== studentId) {
        return NextResponse.json({ error: 'Forbidden: You cannot cancel this sports reservation.' }, { status: 403 });
      }
      if (checkResult.rows[0].status !== cancellableStatus) {
        return NextResponse.json(
            { error: `Sports reservation cannot be cancelled. Its current status is: ${checkResult.rows[0].status}.` },
            { status: 409 }
        );
      }
      return NextResponse.json({ error: 'Failed to cancel sports reservation or reservation not eligible for cancellation.' }, { status: 400 });
    }

    const updatedReservation = result.rows[0];
    console.log('✅ Sports reservation cancelled (status updated) successfully:', updatedReservation);

    return NextResponse.json({
      success: true,
      message: 'Sports reservation cancelled successfully.',
      data: updatedReservation
    }, { status: 200 });

  } catch (_error: unknown) { // FIX: Use underscore prefix
    console.error('💥 Cancel Sports Reservation API Error:', _error);
    if (_error instanceof DatabaseError) {
        console.error('Database error code:', _error.code);
        console.error('Database error message:', _error.message);
    } else if (_error instanceof Error) {
        console.error(_error.stack);
    }
    return NextResponse.json({ error: 'Failed to cancel sports reservation.' }, { status: 500 });
  } finally {
    if (client) {
      try {
        client.release();
        console.log('🔓 Database connection released for cancelling sports reservation');
      } catch (_releaseError: unknown) { // FIX: Use underscore prefix
        console.error('Error releasing database client:', _releaseError);
      }
    }
  }
}