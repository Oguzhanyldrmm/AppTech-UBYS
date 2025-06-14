// app/api/sport-facilities/route.ts

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

// This interface defines the shape of the rich data we'll return for each facility
interface FacilityDetails {
  facility_id: number;
  facility_name: string;
  facility_status: string;
  location_details: string;
  type_id: number;
  type_name: string;
  opening_time: string;
  closing_time: string;
  slot_duration_minutes: number;
}

export async function GET(request: NextRequest) {
  if (!JWT_SECRET || !process.env.DATABASE_URL) {
    console.error('💥 Get Sport Facilities API Error: Server misconfiguration.');
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
  }

  let client;
  try {
    // 1. Authenticate the user to ensure they are logged in
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

    // 3. Query the database using a JOIN to combine data from both tables
    const queryText = `
      SELECT
        sf.id AS facility_id,
        sf.name AS facility_name,
        sf.status AS facility_status,
        sf.location_details,
        sft.id AS type_id,
        sft.name AS type_name,
        sft.opening_time,
        sft.closing_time,
        sft.slot_duration_minutes
      FROM
        sports_facilities sf 
      JOIN
        sports_facility_types sft ON sf.facility_type_id = sft.id
      WHERE
        sf.status = 'available' AND sft.is_active = TRUE
      ORDER BY
        sft.name, sf.name;
    `;

    console.log('🔍 Executing query to fetch all available sport facilities.');
    const result = await client.query<FacilityDetails>(queryText);
    const facilities = result.rows;

    console.log(`📊 Found ${facilities.length} available sport facilities.`);

    return NextResponse.json({
      success: true,
      count: facilities.length,
      data: facilities
    }, { status: 200 });

  } catch (error: unknown) {
    console.error('💥 Get Sport Facilities API Error:', error);
    if (error instanceof DatabaseError) {
      console.error(`Database error details: ${error.message} (Code: ${error.code})`);
      if (error.code === '42P01') {
        return NextResponse.json({ error: 'Database query failed: A table or column may have been misspelled. Please check the API configuration.' }, { status: 500 });
      }
    }
    return NextResponse.json({ error: 'Failed to fetch sport facilities.' }, { status: 500 });
  } finally {
    if (client) {
      client.release();
    }
  }
}
