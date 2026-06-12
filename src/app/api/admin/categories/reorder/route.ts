import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { invalidateCategories } from '@/lib/cache';

export async function POST(request: Request) {
  try {
    const { updates } = await request.json();
    // updates: Array<{ id: string; sortOrder: number }>

    if (!Array.isArray(updates)) {
      return NextResponse.json({ error: 'Geçersiz veri formatı.' }, { status: 400 });
    }

    // Toplu güncelleme için transaction kullanıyoruz
    await db.$transaction(
      updates.map((update) =>
        db.category.update({
          where: { id: update.id },
          data: { sortOrder: update.sortOrder },
        })
      )
    );

    invalidateCategories();
    return NextResponse.json({ success: true, message: 'Kategori sırası güncellendi.' });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Kategori Sıralama API Hatası:', err);
    return NextResponse.json(
      { error: err.message || 'Sıralama güncellenirken hata oluştu.' },
      { status: 500 }
    );
  }
}
