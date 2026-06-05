import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const categories = await db.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        products: {
          where: { isActive: true },
          orderBy: { name: 'asc' },
          include: {
            modifiers: {
              where: { isActive: true }
            }
          }
        },
      },
    });

    return NextResponse.json(categories);
  } catch (error: any) {
    console.error('Kategoriler API Hatası:', error);
    return NextResponse.json(
      { error: 'Kategoriler yüklenirken hata oluştu.' },
      { status: 500 }
    );
  }
}
