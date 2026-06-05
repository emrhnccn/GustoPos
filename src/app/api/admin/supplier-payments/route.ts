import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET: Tedarikçi fatura ve ödeme hareketlerini listele
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const supplierId = searchParams.get('supplierId');

    const where: any = {};
    if (supplierId) {
      where.supplierId = supplierId;
    }

    const payments = await db.supplierPayment.findMany({
      where,
      include: {
        supplier: { select: { name: true } },
        ingredient: { select: { name: true, unit: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(payments);
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Supplier Payments GET error:', err);
    return NextResponse.json({ error: 'Tedarikçi hareketleri yüklenirken hata oluştu.' }, { status: 500 });
  }
}

// POST: Tedarikçi Fatura Girişi (Alış/Borçlanma) veya Ödeme Girişi
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { supplierId, amount, type, ingredientId, quantity, paymentMethod, note } = body;

    if (!supplierId || !amount || !type) {
      return NextResponse.json({ error: 'Eksik alan girdiniz. (supplierId, amount ve type zorunludur)' }, { status: 400 });
    }

    const amtFloat = parseFloat(amount);
    if (isNaN(amtFloat) || amtFloat <= 0) {
      return NextResponse.json({ error: 'Tutar sıfırdan büyük olmalıdır.' }, { status: 400 });
    }

    const result = await db.$transaction(async (tx) => {
      // 1. Tedarikçiyi doğrula
      const supplier = await tx.supplier.findUnique({ where: { id: supplierId } });
      if (!supplier) throw new Error('Tedarikçi bulunamadı.');

      let updatedBalance = supplier.balance;

      if (type === 'INVOICE') {
        // ALIŞ FATURASI: Borcumuz artar
        updatedBalance += amtFloat;

        // Eğer malzeme alımı seçildiyse: Malzeme stoğunu artır ve birim maliyeti güncelle
        if (ingredientId && quantity) {
          const qtyFloat = parseFloat(quantity);
          if (qtyFloat > 0) {
            const ingredient = await tx.ingredient.findUnique({ where: { id: ingredientId } });
            if (!ingredient) throw new Error('İlişkilendirilecek malzeme bulunamadı.');

            // Yeni birim maliyet hesabı (fatura tutarı / miktar)
            const unitCost = Math.round((amtFloat / qtyFloat) * 100) / 100;

            // Malzemeyi güncelle (stok artışı ve maliyet)
            await tx.ingredient.update({
              where: { id: ingredientId },
              data: {
                stockLevel: {
                  increment: qtyFloat
                },
                costPerUnit: unitCost // Ortalama maliyet yerine en son alım maliyeti olarak güncellenir
              }
            });

            // Malzeme stok hareket kaydı
            await tx.ingredientTransaction.create({
              data: {
                ingredientId: ingredientId,
                quantityChanged: qtyFloat,
                transactionType: 'PURCHASE',
                cost: unitCost,
                notes: `${supplier.name} tedarikçisinden fatura #${type} ile alındı.`
              }
            });
          }
        }
      } else if (type === 'PAYMENT') {
        // ÖDEME GİRİŞİ: Borcumuz azalır
        updatedBalance -= amtFloat;
      } else {
        throw new Error('Geçersiz hareket tipi (type must be INVOICE or PAYMENT).');
      }

      // Tedarikçi bakiyesini güncelle
      await tx.supplier.update({
        where: { id: supplierId },
        data: { balance: updatedBalance }
      });

      // Ödeme/Fatura hareket kaydını oluştur
      const paymentLog = await tx.supplierPayment.create({
        data: {
          supplierId,
          ingredientId: type === 'INVOICE' ? ingredientId || null : null,
          amount: amtFloat,
          type,
          paymentMethod: type === 'PAYMENT' ? paymentMethod || 'CASH' : null,
          note
        }
      });

      return paymentLog;
    });

    return NextResponse.json({ success: true, payment: result });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Supplier Payments POST error:', err);
    return NextResponse.json({ error: err.message || 'İşlem başarısız.' }, { status: 500 });
  }
}
