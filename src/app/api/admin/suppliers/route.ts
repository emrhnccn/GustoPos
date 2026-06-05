import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET: Tedarikçileri listele
export async function GET(request: Request) {
  try {
    const suppliers = await db.supplier.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    });
    return NextResponse.json(suppliers);
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Suppliers GET error:', err);
    return NextResponse.json({ error: 'Tedarikçiler yüklenirken hata oluştu.' }, { status: 500 });
  }
}

// POST: Yeni tedarikçi ekle veya güncelle
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, name, phone } = body;

    if (id) {
      // GÜNCELLE
      const updated = await db.supplier.update({
        where: { id },
        data: { name, phone }
      });
      return NextResponse.json({ success: true, supplier: updated });
    } else {
      // EKLE
      if (!name) {
        return NextResponse.json({ error: 'Tedarikçi adı zorunludur.' }, { status: 400 });
      }
      const created = await db.supplier.create({
        data: { name, phone, balance: 0, isActive: true }
      });
      return NextResponse.json({ success: true, supplier: created });
    }
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Suppliers POST error:', err);
    return NextResponse.json({ error: err.message || 'İşlem başarısız.' }, { status: 500 });
  }
}

// DELETE: Tedarikçiyi pasife al (soft delete)
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Tedarikçi ID belirtilmelidir.' }, { status: 400 });
    }

    const deleted = await db.supplier.update({
      where: { id },
      data: { isActive: false }
    });
    return NextResponse.json({ success: true, supplier: deleted });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Suppliers DELETE error:', err);
    return NextResponse.json({ error: err.message || 'Silme işlemi başarısız.' }, { status: 500 });
  }
}
