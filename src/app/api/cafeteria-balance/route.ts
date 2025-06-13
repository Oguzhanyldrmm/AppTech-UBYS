// src/app/api/cafeteria-balance/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import jwt, { JwtPayload } from 'jsonwebtoken'; // Import JwtPayload

// --- Database connection pool (same as before) ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

const JWT_SECRET = process.env.JWT_SECRET;

// Define a more specific type for your JWT payload
// This should match what you put into the token during login
interface TokenPayload extends JwtPayload {
  studentId: string;
  email: string;
  studentIdNo: number;
}

export async function GET(request: NextRequest) {
  if (!JWT_SECRET) {
    console.error('💥 Cafeteria Balance API Error: JWT_SECRET is not available.');
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
  }
  if (!process.env.DATABASE_URL) {
    console.error('💥 Cafeteria Balance API Error: DATABASE_URL is not available.');
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
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

    // 2. Verify the token and extract payload (TYPE-SAFE)
    let decodedPayload: TokenPayload;
    try {
      // Use "as TokenPayload" to assert the type after successful verification
      const verified = jwt.verify(token, JWT_SECRET);
      if (typeof verified === 'string') {
        // This case is rare with your setup but good to handle
        throw new Error("Invalid token payload format");
      }
      decodedPayload = verified as TokenPayload;
      console.log('🔑 Token verified. Payload:', decodedPayload);
    } catch (err: unknown) { // FIX: Use 'unknown' instead of 'any'
      // We check the type of 'err' before using it
      if (err instanceof Error) {
        console.error('❌ Invalid or expired token:', err.message);
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
      console.error('❌ studentId not found in token payload.');
      return NextResponse.json({ error: 'Invalid token payload.' }, { status: 400 });
    }

    console.log(`🔍 Fetching cafeteria balance for studentId: ${studentId}`);

    // 4. Connect to the database (TYPE-SAFE)
    try {
      client = await pool.connect();
    } catch (connectionError: unknown) { // FIX: Use 'unknown' instead of 'any'
      console.error('❌ Database connection failed:', connectionError);
      return NextResponse.json({ error: 'Database connection failed.' }, { status: 503 });
    }

    // 5. Query the cafeteria_balances table
    const queryText = 'SELECT id, student_id, balance FROM cafeteria_balances WHERE student_id = $1';
    const result = await client.query(queryText, [studentId]);

    if (result.rows.length === 0) {
      return NextResponse.json({ success: true, message: 'No cafeteria balance record found.', data: null }, { status: 200 });
    }
    const balanceData = result.rows[0];
    return NextResponse.json({ success: true, data: balanceData, timestamp: new Date().toISOString() });

  } catch (error: unknown) { // FIX: Use 'unknown' instead of 'any'
    console.error('💥 Cafeteria Balance API Error:', error);
    if (error instanceof Error) {
      console.error(error.stack);
    }
    return NextResponse.json({ error: 'Internal server error while fetching cafeteria balance.' }, { status: 500 });
  } finally {
    if (client) {
      try {
        client.release();
      } catch (releaseError: unknown) { // FIX: Use 'unknown' instead of 'any'
         console.error('Error releasing client for cafeteria balance:', releaseError);
      }
    }
  }
}