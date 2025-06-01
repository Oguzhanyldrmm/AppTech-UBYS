import { NextRequest, NextResponse } from 'next/server';
import { mockUsers } from '../_shared/users';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mail, password } = body;

    // Validate input
    if (!mail || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Find user by email and password
    const user = mockUsers.find(
      (u) => u.mail === mail && u.password === password
    );

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Return user data without password

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        studentId: user.studentId,
        department: user.department,
        mail: user.mail,
        tel_no: user.tel_no
      }
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}