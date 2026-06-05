import { NextResponse } from 'next/server';
import { applyDiscount } from '@/lib/services/pos';

export async function POST(request: Request) {
  try {
    const { orderId, discountType, value, adminUserId, waiterUserId } = await request.json();

    if (!orderId || !discountType || value === undefined || !adminUserId || !waiterUserId) {
      return NextResponse.json(
        { error: 'Eksik parametre gönderildi. (orderId, discountType, value, adminUserId, waiterUserId gereklidir)' },
        { status: 400 }
      );
    }

    if (value < 0) {
      return NextResponse.json(
        { error: 'İndirim değeri negatif olamaz.' },
        { status: 400 }
      );
    }

    await applyDiscount(orderId, discountType, value, adminUserId, waiterUserId);
    return NextResponse.json({ success: true, message: 'İndirim başarıyla uygulandı.' });
  } catch (error: any) {
    console.error('İndirim API Hatası:', error);
    return NextResponse.json(
      { error: error.message || 'İndirim uygulanırken hata oluştu.' },
      { status: 500 }
    );
  }
}
