// app/api/login/route.ts (veya senin dosya yolun neyse)

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

// Database connection pool with better configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false,
  max: 20, // maximum number of clients in the pool
  idleTimeoutMillis: 30000, // close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // return an error after 2 seconds if connection could not be established
});

export async function POST(request: NextRequest) {
  let client;
  
  try {
    const body = await request.json();
    const { mail, password } = body;

    // Input validation
    if (!mail || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    console.log('🔍 Login attempt for email:', mail);

    // Better connection handling with timeout
    try {
      client = await pool.connect();
      console.log('✅ Database connected successfully');
    } catch (connectionError) {
      console.error('❌ Database connection failed:', connectionError);
      return NextResponse.json(
        { error: 'Database connection failed' },
        { status: 503 }
      );
    }

    // Query the actual database (not mock data)
    const queryText = 'SELECT * FROM students WHERE email = $1';
    console.log('🔍 Executing query:', queryText, 'with email:', mail);
    
    const result = await client.query(queryText, [mail]);
    console.log('📊 Query result count:', result.rows.length);

    if (result.rows.length === 0) {
      console.log('❌ User not found in database');
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const user = result.rows[0];
    console.log('👤 User found:', user.email);

    // Check password (in production, use bcrypt for hashed passwords)
    if (user.password !== password) {
      console.log('❌ Password mismatch');
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    console.log('✅ Login successful for:', mail);
    
    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    return NextResponse.json({
      success: true,
      user: userWithoutPassword,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('💥 Login API Error:', error);
    
    // More specific error handling
    if (error instanceof Error) {
      if (error.message.includes('connect')) {
        return NextResponse.json(
          { error: 'Database connection error' },
          { status: 503 }
        );
      }
      if (error.message.includes('timeout')) {
        return NextResponse.json(
          { error: 'Database timeout' },
          { status: 504 }
        );
      }
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    // Ensure client is always released
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

export async function GET() {
  let client;
  try {
    // Test database connection
    client = await pool.connect();
    
    const result = await client.query('SELECT NOW() as now');
    
    // Check if students table exists
    const tableCheckQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'students'
      );
    `;
    const tableExists = await client.query(tableCheckQuery);
    
    if (!tableExists.rows[0].exists) {
      return NextResponse.json({ 
        error: 'Students table does not exist',
        table_exists: false,
        cache_buster: Date.now()
      }, { status: 404 });
    }
    
    // Get sample users for debugging
    const usersQuery = 'SELECT id, email, name, student_id_no, department FROM students LIMIT 5';
    const users = await client.query(usersQuery);
    
    return NextResponse.json({ 
      status: 'Database connection successful - REAL DATA',
      time_from_db: result.rows[0].now,
      table_exists: true,
      users_count: users.rows.length,
      sample_users: users.rows,
      cache_buster: Date.now()
    });
  } catch (err) {
    console.error('Database GET Error:', err);
    return NextResponse.json({ 
      error: 'Failed to connect to database',
      details: err instanceof Error ? err.message : 'Unknown error',
      cache_buster: Date.now()
    }, { status: 500 });
  } finally {
    if (client) {
      client.release();
    }
  }
}