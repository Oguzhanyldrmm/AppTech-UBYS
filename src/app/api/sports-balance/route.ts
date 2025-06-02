// app/api/sport-balance/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

// Database connection pool (same configuration as your other APIs)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false // Common for Neon/Vercel, review your specific SSL needs
  } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

const JWT_SECRET = process.env.JWT_SECRET;

// Define a type for the JWT payload we expect
interface TokenPayload {
  studentId: string; // This should be the UUID (from students.id)
  email: string;
  studentIdNo: number; // Assuming you included this in your JWT payload from the login
  iat?: number; // Issued at (automatically added by jsonwebtoken)
  exp?: number; // Expiration time (automatically added by jsonwebtoken)
}

export async function GET(request: NextRequest) {
  if (!JWT_SECRET) {
    console.error('💥 Sport Balance API (GET /api/sport-balances) Error: JWT_SECRET is not available.');
    return NextResponse.json(
      { error: 'Server configuration error. Cannot process request.' },
      { status: 500 }
    );
  }
  if (!process.env.DATABASE_URL) {
    console.error('💥 Sport Balance API (GET /api/sport-balances) Error: DATABASE_URL is not available.');
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
      console.log('❌ No auth token found for sport balance (GET /api/sport-balances). Access denied.');
      return NextResponse.json({ error: 'Authentication required. Please login.' }, { status: 401 });
    }

    // 2. Verify the token and extract payload
    let decodedPayload: TokenPayload;
    try {
      decodedPayload = jwt.verify(token, JWT_SECRET) as TokenPayload;
      console.log('🔑 Token verified for sport balance (GET /api/sport-balances). Payload:', decodedPayload);
    } catch (err: any) {
      console.error('❌ Invalid or expired token for sport balance (GET /api/sport-balances):', err.message);
      if (err.name === 'TokenExpiredError') {
        return NextResponse.json({ error: 'Session expired. Please login again.' }, { status: 401 });
      }
      return NextResponse.json({ error: 'Invalid session. Please login again.' }, { status: 401 });
    }

    // 3. Get studentId from the decoded payload
    const studentId = decodedPayload.studentId;
    if (!studentId) {
      console.error('❌ studentId not found in token payload for sport balance (GET /api/sport-balances).');
      return NextResponse.json({ error: 'Invalid token payload.' }, { status: 400 });
    }

    console.log(`🔍 Fetching sport balance for studentId: ${studentId} via /api/sport-balances`);

    // 4. Connect to the database
    try {
      client = await pool.connect();
      console.log('✅ Database connected successfully for sport balance (GET /api/sport-balances)');
    } catch (connectionError: any) {
      console.error('❌ Database connection failed for sport balance (GET /api/sport-balances):', connectionError);
      return NextResponse.json(
        { error: 'Database connection failed. Please try again later.' },
        { status: 503 }
      );
    }

    // 5. Query the sport_balances table
    // Your screenshot confirmed columns: id (uuid), student_id (uuid), balance (numeric)
    // Assuming your table is named 'sport_balances'. Change if different.
    const queryText = 'SELECT id, student_id, balance FROM sports_balances WHERE student_id = $1';
    console.log('🔍 Executing query for sport balance (GET /api/sport-balances):', queryText, 'with studentId:', studentId);

    const result = await client.query(queryText, [studentId]);

    if (result.rows.length === 0) {
      console.log(`ℹ️ No sport balance found for studentId: ${studentId} (GET /api/sport-balances)`);
      // It's successful in the sense that the query ran and we found no data for this authenticated user.
      // Returning 200 with data: null is a common pattern.
      return NextResponse.json(
        { success: true, message: 'No sport balance record found for this student.', data: null },
        { status: 200 }
      );
    }

    const balanceData = result.rows[0];
    console.log('📊 Sport balance data retrieved (GET /api/sport-balances):', balanceData);

    return NextResponse.json({
      success: true,
      data: balanceData,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('💥 Sport Balance API (GET /api/sport-balances) Error:', error);
    if (error.stack) {
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
        console.log('🔓 Database connection released for sport balance (GET /api/sport-balances)');
      } catch (releaseError) {
        console.error('Error releasing client for sport balance (GET /api/sport-balances):', releaseError);
      }
    }
  }
}

// You can add other HTTP method handlers (POST, PUT, DELETE) to this file
// for the /api/sport-balances route if needed in the future.
// For example, an admin POST to create/set a sport balance (would need different auth).