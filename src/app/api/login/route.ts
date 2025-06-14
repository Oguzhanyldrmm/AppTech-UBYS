// app/api/login/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { Pool, DatabaseError } from 'pg';
import jwt from 'jsonwebtoken';
import { serialize } from 'cookie';
// TODO: When you are ready, install and import bcrypt: npm install bcrypt @types/bcrypt
// import bcrypt from 'bcrypt';

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

export async function POST(request: NextRequest) {
  let client;

  if (!JWT_SECRET || !process.env.DATABASE_URL) {
    console.error('💥 Login API Error: Server misconfiguration.');
    return NextResponse.json(
      { error: 'Server configuration error. Cannot process login.' },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { mail, password } = body;

    if (!mail || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    console.log('🔍 Login attempt for email:', mail);

    try {
      client = await pool.connect();
      console.log('✅ Database connected successfully');
    } catch (connectionError: unknown) {
      console.error('❌ Database connection failed:', connectionError);
      return NextResponse.json(
        { error: 'Database connection failed. Please try again later.' },
        { status: 503 }
      );
    }

    // FIX: Added 'name' and 'department' to the SELECT statement
    const queryText = 'SELECT id, name, department, student_id_no, email, password as password_hash FROM students WHERE email = $1';
    
    console.log('🔍 Executing query:', queryText, 'with email:', mail);

    const result = await client.query(queryText, [mail]);
    console.log('📊 Query result count:', result.rows.length);

    if (result.rows.length === 0) {
      console.log('❌ User not found in database for email:', mail);
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const user = result.rows[0];
    console.log('👤 User found:', user.email, 'Name:', user.name);

    // CRITICAL SECURITY WARNING: Replace this with bcrypt comparison
    const isValidPassword = user.password_hash === password;
    if (!isValidPassword) {
      console.warn(`⚠️ SECURITY ALERT: Login attempt for ${mail} failed due to password mismatch.`);
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    console.log('✅ Password verified for:', mail);

    // Create JWT Payload
    const tokenPayload = {
      studentId: user.id,
      email: user.email,
      studentIdNo: user.student_id_no,
      name: user.name // You can optionally add name to the token if needed elsewhere
    };

    // Sign the JWT
    const token = jwt.sign(tokenPayload, JWT_SECRET, {
      expiresIn: '1d',
    });
    console.log('🔑 JWT generated for:', mail);

    // Serialize the cookie
    const cookieSerialized = serialize('authToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24,
      path: '/',
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password_hash: _, ...userWithoutPasswordHash } = user;

    const response = NextResponse.json({
      success: true,
      user: userWithoutPasswordHash, // This will now include name and department
      message: 'Login successful',
    });
    response.headers.append('Set-Cookie', cookieSerialized);

    console.log('🍪 Cookie set and login successful for:', mail);
    return response;

  } catch (error: unknown) {
    console.error('💥 Login API Error:', error);
    if (error instanceof DatabaseError) {
      console.error(`Database error: ${error.message} (Code: ${error.code})`);
    } else if (error instanceof Error) {
      console.error(error.stack);
    }
    return NextResponse.json(
      { error: 'Internal server error. Please try again later.' },
      { status: 500 }
    );
  } finally {
    if (client) {
      try {
        client.release();
        console.log('🔓 Database connection released');
      } catch (releaseError: unknown) {
        console.error('Error releasing client:', releaseError);
      }
    }
  }
}

export async function GET() {
  console.log('ℹ️ GET request to /api/login');
  return NextResponse.json({
    message: "This is the login API endpoint. Use POST with email and password to login.",
    status: "Healthy",
  });
}
