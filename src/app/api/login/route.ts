// app/api/login/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { serialize } from 'cookie';
// TODO: Install and import bcrypt: npm install bcrypt @types/bcrypt
// import bcrypt from 'bcrypt';

// Database connection pool
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

if (!process.env.DATABASE_URL) {
  console.error('💥 FATAL: DATABASE_URL environment variable is not defined.');
  // Consider throwing an error or exiting if you can't operate without it at startup
  // For an API route, this check at runtime is also good.
}

if (!JWT_SECRET) {
  console.error('💥 FATAL: JWT_SECRET environment variable is not defined. Authentication will not work.');
  // Throwing an error here is reasonable as the app cannot function securely without it.
  // However, for a serverless function, it might only log and fail requests.
  // For robustness in serverless, ensure your deployment environment has this set.
}

export async function POST(request: NextRequest) {
  let client;

  if (!JWT_SECRET) { // Re-check in case of a deployment issue where the initial check didn't prevent startup
    console.error('💥 Login API Error: JWT_SECRET is not available.');
    return NextResponse.json(
      { error: 'Server configuration error. Cannot process login.' },
      { status: 500 }
    );
  }
  if (!process.env.DATABASE_URL) {
    console.error('💥 Login API Error: DATABASE_URL is not available.');
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
    } catch (connectionError: any) {
      console.error('❌ Database connection failed:', connectionError);
      return NextResponse.json(
        { error: 'Database connection failed. Please try again later.' },
        { status: 503 } // Service Unavailable
      );
    }

    // Select the 'id' (uuid) column, 'student_id_no', 'email', and 'password' (as password_hash)
    // !! URGENT: Your 'password' column in the 'students' table currently stores PLAINTEXT.
    // !! It MUST store HASHED passwords (e.g., using bcrypt).
    const queryText = 'SELECT id, student_id_no, email, password as password_hash FROM students WHERE email = $1';
    console.log('🔍 Executing query:', queryText, 'with email:', mail);

    const result = await client.query(queryText, [mail]);
    console.log('📊 Query result count:', result.rows.length);

    if (result.rows.length === 0) {
      console.log('❌ User not found in database for email:', mail);
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 } // Unauthorized
      );
    }

    const user = result.rows[0];
    console.log('👤 User found:', user.email, 'User UUID:', user.id, 'Student No:', user.student_id_no);

    // ==========================================================================
    // CRITICAL SECURITY WARNING - IMPLEMENT PASSWORD HASHING (e.g., using bcrypt)
    // The following direct comparison is EXTREMELY INSECURE because your database
    // currently stores plaintext passwords (as seen in your table screenshot).
    //
    // TODO:
    // 1. Install bcrypt: `npm install bcrypt` and `npm install --save-dev @types/bcrypt`
    // 2. When a user registers OR when you set/change a password:
    //    const saltRounds = 10;
    //    const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);
    //    Store `hashedPassword` in the `students.password` column.
    // 3. Replace the check below with:
    //    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    //    if (!isValidPassword) { ... }
    // ==========================================================================
    const isValidPassword = user.password_hash === password; // <<< !!! INSECURE PLAINTEXT COMPARISON !!! REPLACE THIS
    if (!isValidPassword) {
      console.warn(`⚠️ SECURITY ALERT: Login attempt for ${mail} failed due to password mismatch. PLAINTEXT PASSWORD CHECK IS ACTIVE. FIX THIS!`);
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 } // Unauthorized
      );
    }
    // If you were using bcrypt, it would look like this:
    // const isValidPassword = await bcrypt.compare(password, user.password_hash);
    // if (!isValidPassword) {
    //   console.log('❌ Password mismatch for user:', mail);
    //   return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    // }

    console.log('✅ Password verified for:', mail);

    // Create JWT Payload
    const tokenPayload = {
      studentId: user.id, // This is the UUID (user.id from the database)
      email: user.email,
      studentIdNo: user.student_id_no // Including the student number as well
    };

    // Sign the JWT
    const token = jwt.sign(tokenPayload, JWT_SECRET, { // No need for "as string" if JWT_SECRET is validated at start
      expiresIn: '1d', // Token expiration time (e.g., 1 day, 1h, 7d)
    });
    console.log('🔑 JWT generated for:', mail);

    // Serialize the cookie
    const cookieSerialized = serialize('authToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 1 day in seconds
      path: '/',
    });

    // Remove password from user object before sending response
    const { password_hash: _, ...userWithoutPasswordHash } = user;

    const response = NextResponse.json({
      success: true,
      user: userWithoutPasswordHash,
      message: 'Login successful',
      timestamp: new Date().toISOString()
    });
    response.headers.append('Set-Cookie', cookieSerialized);

    console.log('🍪 Cookie set and login successful for:', mail);
    return response;

  } catch (error: any) {
    console.error('💥 Login API Error:', error);
    // Log more detailed error info if available
    if (error.stack) {
      console.error(error.stack);
    }
    // Check if it's a pg error object for more details
    if (error && error.code) { // Check if 'code' property exists
        console.error('Database error code:', error.code);
        if (error.code === '42703') { // undefined_column
            return NextResponse.json({ error: 'Database schema error. Please contact support.' }, { status: 500 });
        }
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
      } catch (releaseError) {
        console.error('Error releasing client:', releaseError);
      }
    }
  }
}

export async function GET(request: NextRequest) {
  // This endpoint is primarily for POST, but GET can return a status/info
  console.log('ℹ️ GET request to /api/login');
  return NextResponse.json({
    message: "This is the login API endpoint. Use POST with email and password to login.",
    status: "Healthy",
    timestamp: new Date().toISOString()
  });
}