// app/api/cafeteria-reservations/[reservationId]/route.ts

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
  studentIdNo: number;
  iat?: number;
  exp?: number;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { reservationId: string } }
) {
  if (!JWT_SECRET) {
    console.error('💥 Cancel Reservation API Error: JWT_SECRET is not available.');
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
  }
  if (!process.env.DATABASE_URL) {
    console.error('💥 Cancel Reservation API Error: DATABASE_URL is not available.');
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
  }

  const { reservationId } = params; // Get reservationId from the URL path

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
      decodedPayload = jwt.verify(token, JWT_SECRET) as TokenPayload;
    } catch (err: any) {
      console.error('❌ Invalid or expired token for cancelling reservation:', err.message);
      return NextResponse.json({ error: 'Invalid or expired session. Please login again.' }, { status: 401 });
    }

    const studentId = decodedPayload.studentId; // UUID from students.id
    if (!studentId) {
      return NextResponse.json({ error: 'Invalid token: Student ID missing.' }, { status: 400 });
    }

    console.log(`Attempting to cancel reservationId: ${reservationId} for studentId: ${studentId}`);

    // 2. Connect to the database
    try {
      client = await pool.connect();
    } catch (connectionError: any) {
      console.error('❌ Database connection failed for cancelling reservation:', connectionError);
      return NextResponse.json({ error: 'Database connection failed.' }, { status: 503 });
    }

    // 3. Update the reservation status to "cancelled"
    // Ensure the reservation belongs to the authenticated student and is currently 'active' (or any other cancellable status)
    const newStatus = "cancelled";
    const queryText = `
      UPDATE cafeteria_reservations
      SET status = $1
      WHERE id = $2 AND student_id = $3 AND status = 'active' 
      RETURNING id, student_id, reservation_date, meal_type, status;
    `;
    // The "AND status = 'active'" ensures we only cancel active reservations.
    // You can adjust this condition if other statuses are also cancellable.

    const result = await client.query(queryText, [newStatus, reservationId, studentId]);

    if (result.rowCount === 0) {
      // This means no row was updated. It could be because:
      // 1. The reservationId doesn't exist.
      // 2. The reservationId doesn't belong to this student_id.
      // 3. The reservation was not in 'active' status.
      // We should check which one to give a more specific error.
      const checkQuery = 'SELECT student_id, status FROM cafeteria_reservations WHERE id = $1';
      const checkResult = await client.query(checkQuery, [reservationId]);

      if (checkResult.rowCount === 0) {
        return NextResponse.json({ error: 'Reservation not found.' }, { status: 404 });
      }
      if (checkResult.rows[0].student_id !== studentId) {
        // This case should ideally not be hit if the UPDATE query includes student_id,
        // but it's a good defensive check.
        return NextResponse.json({ error: 'Forbidden: You cannot cancel this reservation.' }, { status: 403 });
      }
      if (checkResult.rows[0].status !== 'active') {
        return NextResponse.json(
            { error: `Reservation cannot be cancelled. Its current status is: ${checkResult.rows[0].status}.` },
            { status: 409 } // 409 Conflict - already processed or not in a cancellable state
        );
      }
      // If none of the above, it's an unexpected situation for rowCount to be 0
      return NextResponse.json({ error: 'Failed to cancel reservation or reservation not eligible for cancellation.' }, { status: 400 });
    }

    const updatedReservation = result.rows[0];
    console.log('✅ Reservation cancelled (status updated) successfully:', updatedReservation);

    return NextResponse.json({
      success: true,
      message: 'Reservation cancelled successfully.',
      data: updatedReservation
    }, { status: 200 });

  } catch (error: any) {
    console.error('💥 Cancel Reservation API Error:', error);
    if (error.stack) {
      console.error(error.stack);
    }
    return NextResponse.json({ error: 'Failed to cancel reservation.' }, { status: 500 });
  } finally {
    if (client) {
      client.release();
      console.log('🔓 Database connection released for cancelling reservation');
    }
  }
}