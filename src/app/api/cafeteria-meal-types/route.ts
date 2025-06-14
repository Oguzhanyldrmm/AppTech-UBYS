// app/api/cafeteria-meal-types/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { Pool, DatabaseError } from 'pg';
import jwt from 'jsonwebtoken';

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

// --- Type Interface for the response data ---
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
    // 1. Authenticate the user to ensure they are logged in.
    const tokenCookie = request.cookies.get('authToken');
    const token = tokenCookie?.value;
    if (!token) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    try {
      jwt.verify(token, JWT_SECRET);
    } catch { // The error variable is removed to prevent 'unused var' errors
      return NextResponse.json({ error: 'Invalid or expired session.' }, { status: 401 });
    }

    // 2. Connect to the database
    client = await pool.connect();

    // 3. Query the database for all meal types from the 'meal_types' table
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
