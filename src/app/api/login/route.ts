// app/api/login/route.ts (veya senin dosya yolun neyse)

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

// Database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
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

    client = await pool.connect();
    console.log('✅ Database connected successfully');

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
      timestamp: new Date().toISOString() // Cache busting için
    });

  } catch (error) {
    console.error('💥 Login API Error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  } finally {
    if (client) {
      client.release();
    }
  }
}

export async function GET() {
  let client;
  try {
    client = await pool.connect();
    
    const result = await client.query('SELECT NOW() as now');
    
    // Get all users for debugging (remove in production)
    const usersQuery = 'SELECT id, email, name, student_id_no, department FROM students LIMIT 5';
    const users = await client.query(usersQuery);
    
    return NextResponse.json({ 
      status: 'Database connection successful - REAL DATA',
      time_from_db: result.rows[0].now,
      users_in_db: users.rows,
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