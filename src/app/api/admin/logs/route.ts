import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const logs = await db.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        actorUser: {
          select: { name: true, role: true },
        },
        approverUser: {
          select: { name: true, role: true },
        },
      },
    });

    return NextResponse.json(logs);
  } catch (error: any) {
    console.error('Denetim Logları API Hatası:', error);
    return NextResponse.json(
      { error: 'Log kayıtları yüklenirken hata oluştu.' },
      { status: 500 }
    );
  }
}
