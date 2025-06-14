// app/api/sport-balances/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { Pool, DatabaseError } from 'pg'; // Import DatabaseError
import jwt, { JwtPayload } from 'jsonwebtoken'; // Import JwtPayload

// Database connection pool
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

// Define a type for the JWT payload
interface TokenPayload extends JwtPayload {
  studentId: string;
  email: string;
  studentIdNo: number;
}

export async function GET(request: NextRequest) {
  if (!JWT_SECRET) {
    console.error('💥 Sport Balance API Error: JWT_SECRET is not available.');
    return NextResponse.json(
      { error: 'Server configuration error. Cannot process request.' },
      { status: 500 }
    );
  }
  if (!process.env.DATABASE_URL) {
    console.error('💥 Sport Balance API Error: DATABASE_URL is not available.');
    return NextResponse.json(
      { error: 'Server configuration error. Cannot process request.' },
      { status: 500 }
    );
  }

  let client;
  try {
    // 1. Get the token from the cookie
    const tokenCookie = request.cookies.get('authToken');
    const token = tokenCookie?.value;

    if (!token) {
      console.log('❌ No auth token for sport balance. Access denied.');
      return NextResponse.json({ error: 'Authentication required. Please login.' }, { status: 401 });
    }

    // 2. Verify the token and extract payload
    let decodedPayload: TokenPayload;
    try {
      const verified = jwt.verify(token, JWT_SECRET);
      if (typeof verified === 'string') {
        throw new Error("Invalid token payload format");
      }
      decodedPayload = verified as TokenPayload;
      console.log('🔑 Token verified for sport balance. Payload:', decodedPayload);
    } catch (err: unknown) { // FIX: Use 'unknown' instead of 'any'
      if (err instanceof Error) {
        console.error('❌ Invalid or expired token for sport balance:', err.message);
        if (err.name === 'TokenExpiredError') {
          return NextResponse.json({ error: 'Session expired. Please login again.' }, { status: 401 });
        }
      } else {
        console.error('❌ An unknown token verification error occurred:', err);
      }
      return NextResponse.json({ error: 'Invalid session. Please login again.' }, { status: 401 });
    }

    // 3. Get studentId from the decoded payload
    const studentId = decodedPayload.studentId;
    if (!studentId) {
      console.error('❌ studentId not found in token payload for sport balance.');
      return NextResponse.json({ error: 'Invalid token payload.' }, { status: 400 });
    }

    console.log(`🔍 Fetching sport balance for studentId: ${studentId} via /api/sports-balance`);

    // 4. Connect to the database
    try {
      client = await pool.connect();
      console.log('✅ Database connected successfully for sport balance');
    } catch (connectionError: unknown) { // FIX: Use 'unknown' instead of 'any'
      console.error('❌ Database connection failed for sport balance:', connectionError);
      return NextResponse.json(
        { error: 'Database connection failed. Please try again later.' },
        { status: 503 }
      );
    }

    // 5. Query the sports_balances table
    const queryText = 'SELECT id, student_id, balance FROM sports_balances WHERE student_id = $1';
    console.log('🔍 Executing query for sport balance:', queryText, 'with studentId:', studentId);

    const result = await client.query(queryText, [studentId]);

    if (result.rows.length === 0) {
      console.log(`ℹ️ No sport balance found for studentId: ${studentId}`);
      return NextResponse.json(
        { success: true, message: 'No sport balance record found for this student.', data: null },
        { status: 200 }
      );
    }

    const balanceData = result.rows[0];
    console.log('📊 Sport balance data retrieved:', balanceData);

    return NextResponse.json({
      success: true,
      data: balanceData,
      timestamp: new Date().toISOString()
    });

  } catch (error: unknown) { // FIX: Use 'unknown' instead of 'any'
    console.error('💥 Sport Balance API Error:', error);
    if (error instanceof DatabaseError) {
        console.error(`Database error: ${error.message} (Code: ${error.code})`);
    } else if (error instanceof Error) {
      console.error(error.stack);
    }
    return NextResponse.json(
      { error: 'Internal server error while fetching sport balance.' },
      { status: 500 }
    );
  } finally {
    if (client) {
      try {
        client.release();
        console.log('🔓 Database connection released for sport balance');
      } catch (releaseError: unknown) { // FIX: Use 'unknown' instead of 'any'
        console.error('Error releasing client for sport balance:', releaseError);
      }
    }
  }
}