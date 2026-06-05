import { NextResponse } from 'next/server';
import { mergeTables, transferPartialItems } from '@/lib/services/pos';

export async function POST(request: Request) {
  try {
    const { action, sourceTableId, targetTableId, userId, itemsToTransfer } = await request.json();

    if (!action || !sourceTableId || !targetTableId || !userId) {
      return NextResponse.json(
        { error: 'Eksik parametre gönderildi. (action, sourceTableId, targetTableId, userId gereklidir)' },
        { status: 400 }
      );
    }

    if (action === 'merge') {
      await mergeTables(sourceTableId, targetTableId, userId);
      return NextResponse.json({ success: true, message: 'Masalar başarıyla birleştirildi.' });
    } else if (action === 'transfer') {
      if (!itemsToTransfer || !Array.isArray(itemsToTransfer) || itemsToTransfer.length === 0) {
        return NextResponse.json(
          { error: 'Aktarılacak ürün listesi (itemsToTransfer) belirtilmelidir.' },
          { status: 400 }
        );
      }
      await transferPartialItems(sourceTableId, targetTableId, itemsToTransfer, userId);
      return NextResponse.json({ success: true, message: 'Ürünler başarıyla aktarıldı.' });
    } else {
      return NextResponse.json(
        { error: 'Geçersiz işlem tipi (action: merge veya transfer olmalıdır).' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('Masa Transfer/Birleştirme API Hatası:', error);
    return NextResponse.json(
      { error: error.message || 'İşlem gerçekleştirilemedi.' },
      { status: 500 }
    );
  }
}
