import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET – Tüm yazıcıları ve kategori atamalarını getir
export async function GET() {
  try {
    const printers = await db.printer.findMany({
      where: { isActive: true },
      include: {
        productAssignments: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json(printers);
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Yazıcı Listeleme Hatası:', err);
    return NextResponse.json(
      { error: err.message || 'Yazıcılar yüklenemedi.' },
      { status: 500 }
    );
  }
}

// POST – Yazıcı ekle/güncelle + Ürün atamaları kaydet
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    // === Ürün-Yazıcı Eşleşmelerini Toplu Kaydet ===
    if (action === 'saveAssignments') {
      const { assignments } = body;
      // assignments: Array<{ printerId: string, productId: string }>

      if (!Array.isArray(assignments)) {
        return NextResponse.json(
          { error: 'assignments dizisi gereklidir.' },
          { status: 400 }
        );
      }

      // Mevcut tüm atamaları sil ve yeniden oluştur
      await db.$transaction(async (tx) => {
        await tx.printerProductAssignment.deleteMany({});
        
        if (assignments.length > 0) {
          await tx.printerProductAssignment.createMany({
            data: assignments.map((a: { printerId: string; productId: string }) => ({
              printerId: a.printerId,
              productId: a.productId,
            })),
          });
        }
      });

      return NextResponse.json({ success: true, message: 'Kategori eşleşmeleri kaydedildi.' });
    }

    // === Yazıcı Ekle / Güncelle ===
    const { id, name, windowsName, type, paperWidth } = body;

    if (!name || !windowsName || !type) {
      return NextResponse.json(
        { error: 'Yazıcı adı, Windows yazıcı adı ve tipi zorunludur.' },
        { status: 400 }
      );
    }

    if (id) {
      // Güncelle
      const printer = await db.printer.update({
        where: { id },
        data: {
          name,
          windowsName,
          type,
          paperWidth: paperWidth || 80,
        },
      });
      return NextResponse.json({ success: true, printer });
    } else {
      // Yeni ekle
      const printer = await db.printer.create({
        data: {
          name,
          windowsName,
          type,
          paperWidth: paperWidth || 80,
          isActive: true,
        },
      });
      return NextResponse.json({ success: true, printer });
    }
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Yazıcı Kaydetme Hatası:', err);
    return NextResponse.json(
      { error: err.message || 'Yazıcı kaydedilemedi.' },
      { status: 500 }
    );
  }
}

// DELETE – Yazıcı sil (pasife al)
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Yazıcı ID parametresi gereklidir.' },
        { status: 400 }
      );
    }

    await db.printer.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true, message: 'Yazıcı kaldırıldı.' });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Yazıcı Silme Hatası:', err);
    return NextResponse.json(
      { error: err.message || 'Yazıcı silinemedi.' },
      { status: 500 }
    );
  }
}
