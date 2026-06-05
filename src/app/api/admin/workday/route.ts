import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    
    if (limitParam === 'current') {
      const activeWorkDay = await db.workDay.findFirst({
        where: { status: 'OPEN' },
        include: { 
          startedByUser: { select: { name: true } },
          orders: {
            where: { status: 'PAID' },
            select: { paidAmount: true }
          }
        }
      });
      if (activeWorkDay) {
        const revenue = activeWorkDay.orders.reduce((sum, o) => sum + o.paidAmount, 0);
        const { orders, ...rest } = activeWorkDay;
        return NextResponse.json({ 
          activeWorkDay: {
            ...rest,
            revenue: Math.round(revenue * 100) / 100
          }
        });
      }
      return NextResponse.json({ activeWorkDay: null });
    }

    const workDays = await db.workDay.findMany({
      orderBy: { startTime: 'desc' },
      include: {
        startedByUser: { select: { name: true } },
        _count: { select: { orders: true } },
        orders: {
          where: { status: 'PAID' },
          select: { paidAmount: true }
        }
      },
      take: limitParam ? parseInt(limitParam) : 30
    });

    const workDaysWithRevenue = workDays.map((wd) => {
      const revenue = wd.orders.reduce((sum, o) => sum + o.paidAmount, 0);
      const { orders, ...rest } = wd;
      return {
        ...rest,
        revenue: Math.round(revenue * 100) / 100
      };
    });

    return NextResponse.json(workDaysWithRevenue);
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

      // Açık adisyon kontrolü
      const activeOrdersCount = await db.order.count({
        where: { status: 'ACTIVE' }
      });

      if (activeOrdersCount > 0) {
        return NextResponse.json({ 
          error: `Kapatılmamış ${activeOrdersCount} adet açık adisyon bulunmaktadır! Gün sonu yapmadan önce tüm adisyonları ödeme alarak kapatmalı veya iptal etmelisiniz.` 
        }, { status: 400 });
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
