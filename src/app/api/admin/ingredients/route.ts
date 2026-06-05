import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET: Malzemeleri listele
export async function GET(request: Request) {
  try {
    const ingredients = await db.ingredient.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    });
    return NextResponse.json(ingredients);
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Ingredients GET error:', err);
    return NextResponse.json({ error: 'Malzemeler yüklenirken hata oluştu.' }, { status: 500 });
  }
}

// POST: Yeni malzeme ekle veya mevcut malzemeyi güncelle
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, name, unit, stockLevel, costPerUnit, minStockLevel, isAdjustment, adjustmentQty, adjustmentNotes } = body;

    if (id) {
      // GÜNCELLEME
      const current = await db.ingredient.findUnique({ where: { id } });
      if (!current) {
        return NextResponse.json({ error: 'Malzeme bulunamadı.' }, { status: 404 });
      }

      // Eğer bu bir manuel stok düzeltmesi ise
      if (isAdjustment && adjustmentQty !== undefined) {
        const qtyFloat = parseFloat(adjustmentQty);
        const newStock = current.stockLevel + qtyFloat;

        const updated = await db.$transaction(async (tx) => {
          const ing = await tx.ingredient.update({
            where: { id },
            data: {
              stockLevel: newStock,
              costPerUnit: costPerUnit !== undefined ? parseFloat(costPerUnit) : current.costPerUnit
            }
          });

          await tx.ingredientTransaction.create({
            data: {
              ingredientId: id,
              quantityChanged: qtyFloat,
              transactionType: qtyFloat >= 0 ? 'RESTOCK' : 'MANUAL_CORRECTION',
              notes: adjustmentNotes || 'Manuel stok düzeltmesi.'
            }
          });

          return ing;
        });

        return NextResponse.json({ success: true, ingredient: updated });
      }

      // Normal güncelleme
      const updated = await db.ingredient.update({
        where: { id },
        data: {
          name: name || current.name,
          unit: unit || current.unit,
          costPerUnit: costPerUnit !== undefined ? parseFloat(costPerUnit) : current.costPerUnit,
          minStockLevel: minStockLevel !== undefined ? parseFloat(minStockLevel) : current.minStockLevel,
          stockLevel: stockLevel !== undefined ? parseFloat(stockLevel) : current.stockLevel
        }
      });

      return NextResponse.json({ success: true, ingredient: updated });
    } else {
      // YENİ EKLE
      if (!name || !unit) {
        return NextResponse.json({ error: 'Eksik alan girdiniz. (name ve unit zorunludur)' }, { status: 400 });
      }

      const created = await db.$transaction(async (tx) => {
        const ing = await tx.ingredient.create({
          data: {
            name,
            unit,
            stockLevel: stockLevel !== undefined ? parseFloat(stockLevel) : 0,
            costPerUnit: costPerUnit !== undefined ? parseFloat(costPerUnit) : 0,
            minStockLevel: minStockLevel !== undefined ? parseFloat(minStockLevel) : 0,
            isActive: true
          }
        });

        // Eğer başlangıçta stok belirtilmişse hareket kaydı oluştur
        const initialStock = stockLevel !== undefined ? parseFloat(stockLevel) : 0;
        if (initialStock > 0) {
          await tx.ingredientTransaction.create({
            data: {
              ingredientId: ing.id,
              quantityChanged: initialStock,
              transactionType: 'RESTOCK',
              notes: 'Başlangıç stok girişi.'
            }
          });
        }

        return ing;
      });

      return NextResponse.json({ success: true, ingredient: created });
    }
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Ingredients POST error:', err);
    return NextResponse.json({ error: err.message || 'İşlem başarısız.' }, { status: 500 });
  }
}

// DELETE: Malzemeyi sil (soft-delete)
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Malzeme ID belirtilmelidir.' }, { status: 400 });
    }

    const deleted = await db.ingredient.update({
      where: { id },
      data: { isActive: false }
    });

    return NextResponse.json({ success: true, ingredient: deleted });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Ingredients DELETE error:', err);
    return NextResponse.json({ error: err.message || 'Silme işlemi başarısız.' }, { status: 500 });
  }
}
