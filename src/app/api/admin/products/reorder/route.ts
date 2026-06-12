import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { invalidateProducts } from '@/lib/cache';

export async function POST(request: Request) {
  try {
    const { updates } = await request.json();
    // updates: Array<{ id: string; sortOrder: number; categoryId?: string }>

    if (!Array.isArray(updates)) {
      return NextResponse.json({ error: 'Geçersiz veri formatı.' }, { status: 400 });
    }

    // Toplu güncelleme için transaction kullanıyoruz
    await db.$transaction(
      updates.map((update) =>
        db.product.update({
          where: { id: update.id },
          data: {
            sortOrder: update.sortOrder,
            ...(update.categoryId && { categoryId: update.categoryId }),
          },
        })
      )
    );

    invalidateProducts();
    return NextResponse.json({ success: true, message: 'Ürün sırası güncellendi.' });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Ürün Sıralama API Hatası:', err);
    return NextResponse.json(
      { error: err.message || 'Sıralama güncellenirken hata oluştu.' },
      { status: 500 }
    );
  }
}
