// app/api/login/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { Pool, DatabaseError } from 'pg'; // DatabaseError import ekledim
import jwt from 'jsonwebtoken';
import { serialize } from 'cookie';

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

export async function POST(request: NextRequest) {
  let client;

  if (!process.env.JWT_SECRET || !process.env.DATABASE_URL) {
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

    // Updated query to include name and department
    const queryText = `
      SELECT 
        id, 
        student_id_no, 
        email, 
        name, 
        department, 
        password as password_hash 
      FROM students 
      WHERE email = $1
    `;
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
    console.log('👤 User found:', {
      email: user.email,
      name: user.name,
      department: user.department,
      student_id_no: user.student_id_no,
      id: user.id
    });

    // Password validation
    const isValidPassword = user.password_hash === password;
    if (!isValidPassword) {
      console.warn(`⚠️ SECURITY ALERT: Login attempt for ${mail} failed due to password mismatch.`);
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    console.log('✅ Password verified for:', mail);

    // Create JWT Payload - include name and department
    const tokenPayload = {
      studentId: user.id,
      email: user.email,
      studentIdNo: user.student_id_no,
      name: user.name,
      department: user.department
    };

    // Sign the JWT
    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
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

    // Remove password from response
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password_hash: _, ...userWithoutPasswordHash } = user;

    // Updated response to include name and department
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        student_id_no: user.student_id_no,
        email: user.email,
        name: user.name,
        department: user.department
      },
      message: 'Login successful',
      timestamp: new Date().toISOString()
    });
    
    response.headers.append('Set-Cookie', cookieSerialized);

    console.log('🍪 Cookie set and login successful for:', mail);
    return response;

  } catch (_error: unknown) { // Underscore prefix
    console.error('💥 Login API Error:', _error);

    if (_error instanceof DatabaseError) {
        console.error('Database error code:', _error.code);
        if (_error.code === '42703') {
            return NextResponse.json({ error: 'Database schema error. Please contact support.' }, { status: 500 });
        }
    } else if (_error instanceof Error) {
        console.error(_error.stack);
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
      } catch (_releaseError: unknown) { // Underscore prefix
        console.error('Error releasing client:', _releaseError);
      }
    }
  }
}

// Simple GET endpoint for testing
export async function GET() {
  console.log('ℹ️ GET request to /api/login');
  return NextResponse.json({
    message: "This is the login API endpoint. Use POST with email and password to login.",
    status: "Healthy",
    timestamp: new Date().toISOString()
  });
}