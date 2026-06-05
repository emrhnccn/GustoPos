import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { pin } = await request.json();

    if (!pin || typeof pin !== 'string') {
      return NextResponse.json(
        { error: 'PIN kodu girmek zorunludur.' },
        { status: 400 }
      );
    }

    const user = await db.user.findFirst({
      where: {
        pinHash: pin,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        role: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Hatalı PIN kodu!' },
        { status: 401 }
      );
    }

    return NextResponse.json(user);
  } catch (error: any) {
    console.error('Auth API Hatası:', error);
    return NextResponse.json(
      { error: 'Giriş işlemi sırasında sunucu hatası oluştu.' },
      { status: 500 }
    );
  }
}
