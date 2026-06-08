import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { invalidateTables } from '@/lib/cache';

export async function GET() {
  try {
    const tables = await db.table.findMany({
      orderBy: [
        { area: 'asc' },
        { sortOrder: 'asc' }
      ]
    });
    return NextResponse.json(tables);
  } catch (error: any) {
    console.error('Tables Admin GET API Hatası:', error);
    return NextResponse.json({ error: 'Masalar yüklenemedi.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, id, name, area, direction } = body;

    if (action === 'create') {
      if (!name || !area) {
        return NextResponse.json({ error: 'Ad ve bölge gereklidir.' }, { status: 400 });
      }

      // Bölgedeki maksimum sortOrder'ı bul
      const maxSortOrder = await db.table.aggregate({
        where: { area },
        _max: { sortOrder: true },
      });
      const nextSortOrder = (maxSortOrder._max.sortOrder || 0) + 1;

      const newTable = await db.table.create({
        data: {
          name,
          area,
          status: 'EMPTY',
          sortOrder: nextSortOrder,
        },
      });
      invalidateTables();
      return NextResponse.json(newTable);
    }

    if (action === 'update') {
      if (!id || !name || !area) {
        return NextResponse.json({ error: 'ID, ad ve bölge gereklidir.' }, { status: 400 });
      }
      const updated = await db.table.update({
        where: { id },
        data: { name, area },
      });
      invalidateTables();
      return NextResponse.json(updated);
    }

    if (action === 'delete') {
      if (!id) return NextResponse.json({ error: 'ID gereklidir.' }, { status: 400 });
      const table = await db.table.findUnique({ where: { id } });
      if (!table) return NextResponse.json({ error: 'Masa bulunamadı.' }, { status: 404 });
      if (table.activeOrderId) {
        return NextResponse.json({ error: 'Aktif adisyonu olan masa silinemez.' }, { status: 400 });
      }

      await db.table.delete({ where: { id } });
      invalidateTables();
      return NextResponse.json({ success: true });
    }

    if (action === 'sort') {
      if (!id || !direction) {
        return NextResponse.json({ error: 'Masa ID ve yön (direction: up/down) gereklidir.' }, { status: 400 });
      }
      const currentTable = await db.table.findUnique({ where: { id } });
      if (!currentTable) return NextResponse.json({ error: 'Masa bulunamadı.' }, { status: 404 });

      const siblingTables = await db.table.findMany({
        where: { area: currentTable.area },
        orderBy: { sortOrder: 'asc' },
      });

      const currentIndex = siblingTables.findIndex((t) => t.id === id);
      if (currentIndex === -1) return NextResponse.json({ error: 'Masa listede bulunamadı.' }, { status: 400 });

      let targetIndex = -1;
      if (direction === 'up' && currentIndex > 0) {
        targetIndex = currentIndex - 1;
      } else if (direction === 'down' && currentIndex < siblingTables.length - 1) {
        targetIndex = currentIndex + 1;
      }

      if (targetIndex !== -1) {
        const targetTable = siblingTables[targetIndex];
        
        await db.$transaction([
          db.table.update({
            where: { id: currentTable.id },
            data: { sortOrder: targetTable.sortOrder },
          }),
          db.table.update({
            where: { id: targetTable.id },
            data: { sortOrder: currentTable.sortOrder },
          }),
        ]);
      }
      invalidateTables();
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Geçersiz işlem.' }, { status: 400 });
  } catch (error: any) {
    console.error('Tables Admin POST API Hatası:', error);
    return NextResponse.json({ error: error.message || 'İşlem başarısız.' }, { status: 500 });
  }
}
