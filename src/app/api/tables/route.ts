import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const tables = await db.table.findMany({
      orderBy: [
        { area: 'asc' },
        { sortOrder: 'asc' }
      ]
    });

    // Masalara bağlı aktif siparişleri topluca veya ilişkisel olarak çekelim.
    // SQLite'ta activeOrderId üzerinden doğrudan Order'ı eşleştirebiliriz.
    const activeOrderIds = tables
      .map((t) => t.activeOrderId)
      .filter((id): id is string => !!id);

    const activeOrders = await db.order.findMany({
      where: {
        id: { in: activeOrderIds },
        status: 'ACTIVE',
      },
      include: {
        items: {
          where: { status: { in: ['ACTIVE', 'COMPLIMENTARY'] } },
        },
        payments: true,
      },
    });

    const ordersMap = new Map(activeOrders.map((o) => [o.id, o]));

    const tablesWithOrders = tables.map((table) => {
      const activeOrder = table.activeOrderId ? ordersMap.get(table.activeOrderId) : null;
      return {
        ...table,
        activeOrder: activeOrder ? {
          id: activeOrder.id,
          totalAmount: activeOrder.totalAmount,
          discountAmount: activeOrder.discountAmount,
          paidAmount: activeOrder.paidAmount,
          createdAt: activeOrder.createdAt,
          updatedAt: activeOrder.updatedAt,
          items: activeOrder.items.map((item) => ({
            id: item.id,
            productId: item.productId,
            productName: item.productName,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
            note: item.note,
            status: item.status,
            selectedModifiers: item.selectedModifiers,
            createdAt: item.createdAt,
          })),
          payments: activeOrder.payments,
        } : null,
      };
    });

    return NextResponse.json(tablesWithOrders);
  } catch (error: any) {
    console.error('Masalar API Hatası:', error);
    return NextResponse.json(
      { error: 'Masa listesi yüklenirken hata oluştu.' },
      { status: 500 }
    );
  }
}
