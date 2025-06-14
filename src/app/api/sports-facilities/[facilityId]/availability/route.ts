// app/api/sport-facilities/[facilityId]/availability/route.ts

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

interface FacilityRules {
  opening_time: string; // "HH:MM:SS"
  closing_time: string; // "HH:MM:SS"
  slot_duration_minutes: number;
}

interface ExistingReservation {
    reservation_start_time: Date;
}

interface TimeSlot {
    start_time: string; // ISO 8601 format with local offset
    end_time: string;   // ISO 8601 format with local offset
}


export async function GET(
    request: NextRequest,
    context: { params: { facilityId: string } }
) {
  if (!JWT_SECRET || !process.env.DATABASE_URL) {
    console.error('💥 Get Availability API Error: Server misconfiguration.');
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
  }

  let client;
  try {
    const { facilityId } = context.params;
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date'); // Expects "YYYY-MM-DD"

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return NextResponse.json({ error: 'A valid date parameter in YYYY-MM-DD format is required.' }, { status: 400 });
    }
    
    // 1. Authenticate the user
    const tokenCookie = request.cookies.get('authToken');
    const token = tokenCookie?.value;
    if (!token) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    try {
      jwt.verify(token, JWT_SECRET);
    } catch (err: unknown) {
      return NextResponse.json({ error: 'Invalid or expired session.' }, { status: 401 });
    }

    client = await pool.connect();

    // 2. Get facility rules (opening/closing times, slot duration)
    const facilityRulesQuery = `
        SELECT sft.opening_time, sft.closing_time, sft.slot_duration_minutes
        FROM sports_facilities sf
        JOIN sports_facility_types sft ON sf.facility_type_id = sft.id
        WHERE sf.id = $1;
    `;
    const facilityRulesResult = await client.query<FacilityRules>(facilityRulesQuery, [facilityId]);

    if (facilityRulesResult.rows.length === 0) {
        return NextResponse.json({ error: 'Facility not found.' }, { status: 404 });
    }
    const { opening_time, closing_time, slot_duration_minutes } = facilityRulesResult.rows[0];

    // 3. Get existing reservations for that facility on the given day
    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const existingReservationsQuery = `
        SELECT reservation_start_time
        FROM sports_reservations
        WHERE facility_id = $1 AND reservation_start_time >= $2 AND reservation_start_time < $3;
    `;
    const existingReservationsResult = await client.query<ExistingReservation>(existingReservationsQuery, [facilityId, dayStart, dayEnd]);
    const bookedSlots = existingReservationsResult.rows;

    // 4. Generate all possible slots for the day in the LOCAL timezone (+03:00)
    const localTimezone = "+03:00";
    const allSlots: TimeSlot[] = [];

    // Create date objects with the specified local timezone
    let currentSlotStart = new Date(`${date}T${opening_time}${localTimezone}`);
    const closingTime = new Date(`${date}T${closing_time}${localTimezone}`);

    // Helper function to format a Date object into a local ISO string
    const formatToLocalISO = (d: Date): string => {
        const pad = (num: number) => num.toString().padStart(2, '0');
        const year = d.getFullYear();
        const month = pad(d.getMonth() + 1);
        const day = pad(d.getDate());
        const hours = pad(d.getHours());
        const minutes = pad(d.getMinutes());
        const seconds = pad(d.getSeconds());
        return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${localTimezone}`;
    };

    while(currentSlotStart < closingTime) {
        const currentSlotEnd = new Date(currentSlotStart);
        currentSlotEnd.setMinutes(currentSlotEnd.getMinutes() + slot_duration_minutes);

        if (currentSlotEnd > closingTime) break;

        allSlots.push({
            start_time: formatToLocalISO(currentSlotStart),
            end_time: formatToLocalISO(currentSlotEnd),
        });
        currentSlotStart = currentSlotEnd;
    }

    // 5. Filter out booked slots
    // The comparison logic using .getTime() is timezone-proof and still works perfectly.
    const bookedStartTimes = new Set(bookedSlots.map(slot => slot.reservation_start_time.getTime()));

    const availableSlots = allSlots.filter(slot => {
        const slotStartTime = new Date(slot.start_time).getTime();
        return !bookedStartTimes.has(slotStartTime);
    });

    return NextResponse.json({
      success: true,
      data: {
        facilityId: facilityId,
        date: date,
        available_slots: availableSlots
      }
    }, { status: 200 });

  } catch (error: unknown) {
    console.error('💥 Get Availability API Error:', error);
    if (error instanceof DatabaseError) {
      console.error(`Database error: ${error.message} (Code: ${error.code})`);
    }
    return NextResponse.json({ error: 'Failed to fetch facility availability.' }, { status: 500 });
  } finally {
    if (client) {
      client.release();
    }
  }
}
