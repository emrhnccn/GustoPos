import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { invalidateProducts } from '@/lib/cache';

// 1. Yeni Ürün Ekle
export async function POST(request: Request) {
  try {
    const { name, price, categoryId, isStockControlled, stockLevel, image, modifierIds, newModifiers } = await request.json();

    if (!name || price === undefined || !categoryId) {
      return NextResponse.json(
        { error: 'Eksik alan girdiniz. (name, price, categoryId zorunludur)' },
        { status: 450 }
      );
    }

    const product = await db.product.create({
      data: {
        name,
        price: parseFloat(price),
        categoryId,
        image: image || null,
        isStockControlled: !!isStockControlled,
        stockLevel: parseFloat(stockLevel || 0),
        isActive: true,
        modifiers: {
          connect: (modifierIds || []).map((id: string) => ({ id })),
          create: (newModifiers || []).map((m: { name: string; price?: number | string }) => ({
            name: m.name,
            price: parseFloat(String(m.price || 0)),
            isActive: true,
          })),
        },
      },
    });

    invalidateProducts();
    return NextResponse.json({ success: true, product });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Ürün Ekleme API Hatası:', err);
    return NextResponse.json(
      { error: err.message || 'Ürün oluşturulurken hata oluştu.' },
      { status: 500 }
    );
  }
}

// 2. Ürün Güncelle
export async function PUT(request: Request) {
  try {
    const { id, name, price, categoryId, isStockControlled, stockLevel, isActive, image, modifierIds, newModifiers } = await request.json();

    if (!id || !name || price === undefined || !categoryId) {
      return NextResponse.json(
        { error: 'Eksik alan girdiniz. (id, name, price, categoryId zorunludur)' },
        { status: 400 }
      );
    }

    const product = await db.product.update({
      where: { id },
      data: {
        name,
        price: parseFloat(price),
        categoryId,
        image: image !== undefined ? image : undefined,
        isStockControlled: !!isStockControlled,
        stockLevel: parseFloat(stockLevel || 0),
        isActive: isActive !== undefined ? !!isActive : true,
        modifiers: {
          set: (modifierIds || []).map((id: string) => ({ id })),
          create: (newModifiers || []).map((m: { name: string; price?: number | string }) => ({
            name: m.name,
            price: parseFloat(String(m.price || 0)),
            isActive: true,
          })),
        },
      },
    });

    invalidateProducts();
    return NextResponse.json({ success: true, product });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Ürün Güncelleme API Hatası:', err);
    return NextResponse.json(
      { error: err.message || 'Ürün güncellenirken hata oluştu.' },
      { status: 500 }
    );
  }
}

// 3. Ürün Sil (Pasife Al - Soft Delete)
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Ürün ID (id) parametresi belirtilmelidir.' },
        { status: 400 }
      );
    }

    // Geçmiş raporların ve Z Raporunun bozulmaması için ürünü soft-delete (isActive: false) yapıyoruz
    const product = await db.product.update({
      where: { id },
      data: { isActive: false },
    });

    invalidateProducts();
    return NextResponse.json({ success: true, message: 'Ürün başarıyla menüden kaldırıldı (pasifleştirildi).', product });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Ürün Silme API Hatası:', err);
    return NextResponse.json(
      { error: err.message || 'Ürün silinirken hata oluştu.' },
      { status: 500 }
    );
  }
}
