import { NextResponse } from 'next/server';
import { addOrderItems } from '@/lib/services/pos';

export async function POST(request: Request) {
  try {
    const { tableId, items, waiterUserId } = await request.json();

    if (!tableId || !items || !Array.isArray(items) || items.length === 0 || !waiterUserId) {
      return NextResponse.json(
        { error: 'Eksik parametre gönderildi. (tableId, items, waiterUserId gereklidir)' },
        { status: 400 }
      );
    }

    const result = await addOrderItems(tableId, items, waiterUserId);
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Sipariş Oluşturma API Hatası:', error);
    return NextResponse.json(
      { error: error.message || 'Sipariş eklenirken hata oluştu.' },
      { status: 500 }
    );
  }
}
