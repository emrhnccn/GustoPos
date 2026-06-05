import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// 1. Yeni Kategori Ekle
export async function POST(request: Request) {
  try {
    const { name, sortOrder } = await request.json();

    if (!name) {
      return NextResponse.json(
        { error: 'Kategori adı (name) zorunludur.' },
        { status: 400 }
      );
    }

    const category = await db.category.create({
      data: {
        name,
        sortOrder: sortOrder !== undefined ? parseInt(sortOrder) : 0,
        isActive: true,
      },
    });

    return NextResponse.json({ success: true, category });
  } catch (error: any) {
    console.error('Kategori Ekleme API Hatası:', error);
    return NextResponse.json(
      { error: error.message || 'Kategori oluşturulurken hata oluştu.' },
      { status: 500 }
    );
  }
}

// 2. Kategori Güncelle
export async function PUT(request: Request) {
  try {
    const { id, name, sortOrder, isActive } = await request.json();

    if (!id || !name) {
      return NextResponse.json(
        { error: 'Kategori ID (id) ve adı (name) zorunludur.' },
        { status: 400 }
      );
    }

    const category = await db.category.update({
      where: { id },
      data: {
        name,
        sortOrder: sortOrder !== undefined ? parseInt(sortOrder) : 0,
        isActive: isActive !== undefined ? !!isActive : true,
      },
    });

    return NextResponse.json({ success: true, category });
  } catch (error: any) {
    console.error('Kategori Güncelleme API Hatası:', error);
    return NextResponse.json(
      { error: error.message || 'Kategori güncellenirken hata oluştu.' },
      { status: 500 }
    );
  }
}

// 3. Kategori Sil (Pasife Al - Altındaki ürünlerle birlikte)
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Kategori ID (id) parametresi belirtilmelidir.' },
        { status: 400 }
      );
    }

    // SQLite/Transaction ile kategoriyi ve altındaki tüm ürünleri pasife al
    const result = await db.$transaction(async (tx) => {
      const category = await tx.category.update({
        where: { id },
        data: { isActive: false },
      });

      // Altındaki ürünleri de pasife al
      await tx.product.updateMany({
        where: { categoryId: id },
        data: { isActive: false },
      });

      return category;
    });

    return NextResponse.json({
      success: true,
      message: 'Kategori ve bağlı tüm ürünler menüden kaldırıldı (pasifleştirildi).',
      category: result,
    });
  } catch (error: any) {
    console.error('Kategori Silme API Hatası:', error);
    return NextResponse.json(
      { error: error.message || 'Kategori silinirken hata oluştu.' },
      { status: 500 }
    );
  }
}
