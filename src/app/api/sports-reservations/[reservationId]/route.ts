// app/api/sports-reservations/[reservationId]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { Pool, DatabaseError } from 'pg'; // Import DatabaseError
import jwt, { JwtPayload } from 'jsonwebtoken'; // Import JwtPayload

// --- Database connection pool ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: { reservationId: string } }
) {
  if (!JWT_SECRET || !process.env.DATABASE_URL) {
    console.error('💥 Cancel Sports Reservation API Error: Server misconfiguration.');
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
  }

  const { reservationId } = params;

  if (!reservationId || typeof reservationId !== 'string') {
    return NextResponse.json({ error: 'Invalid reservation ID.' }, { status: 400 });
  }

  let client;
  try {
    // 1. Authenticate the user
    const tokenCookie = request.cookies.get('authToken');
    const token = tokenCookie?.value;
    if (!token) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    let decodedPayload: TokenPayload;
    try {
      const verified = jwt.verify(token, JWT_SECRET);
      if (typeof verified === 'string') {
          throw new Error("Invalid token payload format");
      }
      decodedPayload = verified as TokenPayload;
    } catch (err: unknown) { // FIX: Use 'unknown' instead of 'any'
      if (err instanceof Error) {
        console.error('❌ Invalid or expired token for cancelling sports reservation:', err.message);
      } else {
        console.error('❌ An unknown token verification error occurred:', err);
      }
      return NextResponse.json({ error: 'Invalid or expired session. Please login again.' }, { status: 401 });
    }

    const studentId = decodedPayload.studentId;
    if (!studentId) {
      return NextResponse.json({ error: 'Invalid token: Student ID missing.' }, { status: 400 });
    }

    console.log(`Attempting to cancel sports reservationId: ${reservationId} for studentId: ${studentId}`);

    // 2. Connect to the database
    client = await pool.connect();

    // 3. Update the reservation status
    const newStatus = "cancelled";
    const cancellableStatus = "confirmed";

    const queryText = `
      UPDATE sports_reservations
      SET status = $1
      WHERE id = $2 AND student_id = $3 AND status = $4
      RETURNING id, student_id, facility_type, reservation_start_time, reservation_end_time, status;
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
            { error: `Sports reservation cannot be cancelled. Current status: ${checkResult.rows[0].status}.` },
            { status: 409 }
        );
      }
      return NextResponse.json({ error: 'Failed to cancel sports reservation or not eligible.' }, { status: 400 });
    }

    const updatedReservation = result.rows[0];
    console.log('✅ Sports reservation cancelled successfully:', updatedReservation);

    return NextResponse.json({
      success: true,
      message: 'Sports reservation cancelled successfully.',
      data: updatedReservation
    }, { status: 200 });

  } catch (error: unknown) { // FIX: Use 'unknown' instead of 'any'
    console.error('💥 Cancel Sports Reservation API Error:', error);
    if (error instanceof DatabaseError) {
        console.error(`Database error: ${error.message} (Code: ${error.code})`);
    } else if (error instanceof Error) {
      console.error(error.stack);
    }
    return NextResponse.json({ error: 'Failed to cancel sports reservation.' }, { status: 500 });
  } finally {
    if (client) {
      try {
        client.release();
        console.log('🔓 Database connection released for cancelling sports reservation');
      } catch (releaseError: unknown) { // FIX: Use 'unknown'
         console.error('Error releasing client for sports reservation:', releaseError);
      }
    }
  }
}