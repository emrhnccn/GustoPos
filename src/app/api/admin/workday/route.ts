import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    
    if (limitParam === 'current') {
      const activeWorkDay = await db.workDay.findFirst({
        where: { status: 'OPEN' },
        include: { startedByUser: { select: { name: true } } }
      });
      return NextResponse.json({ activeWorkDay });
    }

    const workDays = await db.workDay.findMany({
      orderBy: { startTime: 'desc' },
      include: {
        startedByUser: { select: { name: true } },
        _count: { select: { orders: true } }
      },
      take: limitParam ? parseInt(limitParam) : 30
    });

    return NextResponse.json(workDays);
  } catch (error) {
    console.error('WorkDay GET error:', error);
    return NextResponse.json({ error: 'Gün başı bilgileri alınamadı.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { action, userId } = await request.json();

    if (action === 'START') {
      const existingOpen = await db.workDay.findFirst({
        where: { status: 'OPEN' }
      });

      if (existingOpen) {
        return NextResponse.json({ error: 'Zaten açık bir gün var. Önce gün sonu yapmalısınız.' }, { status: 400 });
      }

      const newWorkDay = await db.workDay.create({
        data: {
          status: 'OPEN',
          startedByUserId: userId || null
        }
      });
      return NextResponse.json(newWorkDay);
    } 
    
    else if (action === 'END') {
      const existingOpen = await db.workDay.findFirst({
        where: { status: 'OPEN' }
      });

      if (!existingOpen) {
        return NextResponse.json({ error: 'Açık bir gün bulunamadı.' }, { status: 400 });
      }

      // Gün sonu yapıldığında aktif masaları uyarmalı veya kapatmalı mıyız?
      // İsteğe bağlı olarak açık masalar uyarılabilir. Şimdilik sadece günü kapatıyoruz.
      
      const closedDay = await db.workDay.update({
        where: { id: existingOpen.id },
        data: {
          status: 'CLOSED',
          endTime: new Date()
        }
      });

      return NextResponse.json(closedDay);
    }

    return NextResponse.json({ error: 'Geçersiz işlem.' }, { status: 400 });
  } catch (error) {
    console.error('WorkDay POST error:', error);
    return NextResponse.json({ error: 'Gün başı/sonu işlemi başarısız.' }, { status: 500 });
  }
}
