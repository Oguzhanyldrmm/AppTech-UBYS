// app/api/cafeteria-meal-types/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { Pool, DatabaseError } from 'pg';
import jwt, { JwtPayload } from 'jsonwebtoken';

// --- Database connection pool ---
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

// --- Type Interfaces ---
interface TokenPayload extends JwtPayload {
  studentId: string;
}

interface MealType {
  id: number;
  name: string;
}

export async function GET(request: NextRequest) {
  if (!JWT_SECRET || !process.env.DATABASE_URL) {
    console.error('💥 Get Meal Types API Error: Server misconfiguration.');
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
  }

  let client;
  try {
    // 1. Authenticate the user (optional but good practice)
    // Ensures only logged-in users can see the meal types.
    const tokenCookie = request.cookies.get('authToken');
    const token = tokenCookie?.value;
    if (!token) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    try {
      jwt.verify(token, JWT_SECRET);
    } catch (err: unknown) {
      if (err instanceof Error) console.error('Token verification failed:', err.message);
      return NextResponse.json({ error: 'Invalid or expired session.' }, { status: 401 });
    }

    // 2. Connect to the database
    client = await pool.connect();

    // 3. Query the database for all meal types
    // Assuming your table is named 'cafeteria_meal_types'
    const queryText = `
      SELECT id, name
      FROM meal_types
      ORDER BY id ASC;
    `;

    console.log('🔍 Executing query to fetch all cafeteria meal types.');
    const result = await client.query<MealType>(queryText);
    const mealTypes = result.rows;

    console.log(`📊 Found ${mealTypes.length} meal types.`);

    return NextResponse.json({
      success: true,
      count: mealTypes.length,
      data: mealTypes
    }, { status: 200 });

  } catch (error: unknown) {
    console.error('💥 Get Meal Types API Error:', error);
    if (error instanceof DatabaseError) {
      console.error(`Database error: ${error.message} (Code: ${error.code})`);
      // A common error is '42P01' which means the table does not exist.
      if (error.code === '42P01') {
        return NextResponse.json({ error: 'Database query failed: The meal types table may be misspelled or missing.' }, { status: 500 });
      }
    }
    return NextResponse.json({ error: 'Failed to fetch meal types.' }, { status: 500 });
  } finally {
    if (client) {
      client.release();
    }
  }
}
