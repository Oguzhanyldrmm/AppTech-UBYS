// app/api/cafeteria-balance/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

// Database connection pool (same configuration as your login API)
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

export async function GET(request: NextRequest) {
  if (!JWT_SECRET) {
    console.error('💥 Cafeteria Balance API Error: JWT_SECRET is not available.');
    return NextResponse.json(
      { error: 'Server configuration error. Cannot process request.' },
      { status: 500 }
    );
  }
  if (!process.env.DATABASE_URL) {
    console.error('💥 Cafeteria Balance API Error: DATABASE_URL is not available.');
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
      console.log('❌ No auth token found. Access denied.');
      return NextResponse.json({ error: 'Authentication required. Please login.' }, { status: 401 });
    }

    // 2. Verify the token and extract payload
    let decodedPayload: any; // Use 'any' or define a specific type for your payload
    try {
      decodedPayload = jwt.verify(token, JWT_SECRET);
      console.log('🔑 Token verified. Payload:', decodedPayload);
    } catch (err: any) {
      console.error('❌ Invalid or expired token:', err.message);
      // Specific checks for token errors
      if (err.name === 'TokenExpiredError') {
        return NextResponse.json({ error: 'Session expired. Please login again.' }, { status: 401 });
      }
      return NextResponse.json({ error: 'Invalid session. Please login again.' }, { status: 401 });
    }

    // 3. Get studentId from the decoded payload
    // This 'studentId' should be the UUID (user.id) we stored during login.
    const studentId = decodedPayload.studentId;
    if (!studentId) {
      console.error('❌ studentId not found in token payload.');
      return NextResponse.json({ error: 'Invalid token payload.' }, { status: 400 });
    }

    console.log(`🔍 Fetching cafeteria balance for studentId: ${studentId}`);

    // 4. Connect to the database
    try {
      client = await pool.connect();
      console.log('✅ Database connected successfully for cafeteria balance');
    } catch (connectionError: any) {
      console.error('❌ Database connection failed:', connectionError);
      return NextResponse.json(
        { error: 'Database connection failed. Please try again later.' },
        { status: 503 }
      );
    }

    // 5. Query the cafeteria_balances table
    // Assuming your cafeteria_balances table has 'student_id' (uuid) and 'balance' columns
    // And 'id' as the primary key for the balance record itself.
    const queryText = 'SELECT id, student_id, balance FROM cafeteria_balances WHERE student_id = $1';
    console.log('🔍 Executing query:', queryText, 'with studentId:', studentId);

    const result = await client.query(queryText, [studentId]);

    if (result.rows.length === 0) {
      console.log(`ℹ️ No cafeteria balance found for studentId: ${studentId}`);
      return NextResponse.json(
        { success: true, message: 'No cafeteria balance record found for this student.', data: null },
        { status: 200 } // Or 404 if you prefer to indicate resource not found strictly
      );
    }

    const balanceData = result.rows[0];
    console.log('📊 Cafeteria balance data retrieved:', balanceData);

    return NextResponse.json({
      success: true,
      data: balanceData,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('💥 Cafeteria Balance API (GET /me) Error:', error);
    if (error.stack) {
      console.error(error.stack);
    }
    return NextResponse.json(
      { error: 'Internal server error while fetching cafeteria balance.' },
      { status: 500 }
    );
  } finally {
    if (client) {
      try {
        client.release();
        console.log('🔓 Database connection released for cafeteria balance');
      } catch (releaseError) {
        console.error('Error releasing client for cafeteria balance:', releaseError);
      }
    }
  }
}