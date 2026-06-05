import { NextResponse } from 'next/server';
import { cancelOrderItem, makeItemComplimentary } from '@/lib/services/pos';

export async function POST(request: Request) {
  try {
    const { action, orderItemId, quantity, cancelReason, adminUserId, waiterUserId } = await request.json();

    if (!action || !orderItemId || quantity === undefined || !adminUserId || !waiterUserId) {
      return NextResponse.json(
        { error: 'Eksik parametre gönderildi. (action, orderItemId, quantity, adminUserId, waiterUserId gereklidir)' },
        { status: 400 }
      );
    }

    if (quantity <= 0) {
      return NextResponse.json(
        { error: 'İşlem yapılacak miktar sıfırdan büyük olmalıdır.' },
        { status: 400 }
      );
    }

    if (action === 'cancel') {
      if (!cancelReason) {
        return NextResponse.json(
          { error: 'İptal işlemi için bir gerekçe (cancelReason) belirtilmelidir.' },
          { status: 400 }
        );
      }
      await cancelOrderItem(orderItemId, quantity, cancelReason, adminUserId, waiterUserId);
      return NextResponse.json({ success: true, message: 'Ürün iptal edildi.' });
    } else if (action === 'complimentary') {
      await makeItemComplimentary(orderItemId, quantity, adminUserId, waiterUserId);
      return NextResponse.json({ success: true, message: 'Ürün ikram edildi.' });
    } else {
      return NextResponse.json(
        { error: 'Geçersiz işlem tipi (action: cancel veya complimentary olmalıdır).' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('Ürün İptal/İkram API Hatası:', error);
    return NextResponse.json(
      { error: error.message || 'İşlem gerçekleştirilemedi.' },
      { status: 500 }
    );
  }
}
