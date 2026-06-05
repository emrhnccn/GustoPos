import { NextResponse } from 'next/server';
import { addSplitPayment, payPartialItems } from '@/lib/services/pos';

export async function POST(request: Request) {
  try {
    const { tableId, amount, paymentMethod, customerId, itemsToPay } = await request.json();

    if (!tableId || !paymentMethod) {
      return NextResponse.json(
        { error: 'Eksik parametre gönderildi. (tableId ve paymentMethod gereklidir)' },
        { status: 400 }
      );
    }

    if (itemsToPay && Array.isArray(itemsToPay) && itemsToPay.length > 0) {
      // Alman Usulü (Kısmi Ürün) Ödeme
      const result = await payPartialItems(tableId, itemsToPay, paymentMethod, customerId);
      return NextResponse.json({ success: true, ...result });
    } else {
      // Normal/Parçalı Tutar Ödemesi
      if (amount === undefined || amount <= 0) {
        return NextResponse.json(
          { error: 'Ödeme tutarı sıfırdan büyük olmalıdır.' },
          { status: 400 }
        );
      }
      const result = await addSplitPayment(tableId, amount, paymentMethod, customerId);
      return NextResponse.json({ success: true, ...result });
    }
  } catch (error: any) {
    console.error('Ödeme API Hatası:', error);
    return NextResponse.json(
      { error: error.message || 'Ödeme alınırken hata oluştu.' },
      { status: 500 }
    );
  }
}
