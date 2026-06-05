import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('id');

    if (customerId) {
      const customer = await db.customer.findUnique({
        where: { id: customerId }
      });
      if (!customer) return NextResponse.json({ error: 'Müşteri bulunamadı.' }, { status: 404 });

      // Cariye yazılmış kapatılmış siparişler
      const orders = await db.order.findMany({
        where: {
          customerId: customerId,
          status: 'PAID',
          payments: {
            some: {
              paymentMethod: 'CARI'
            }
          }
        },
        include: {
          items: true,
          payments: true,
          waiterUser: {
            select: { name: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      // Müşteriye ait tahsilat audit logları
      const customerAuditLogs = await db.auditLog.findMany({
        where: {
          description: {
            contains: `Cari Müşteri '${customer.name}'`
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      return NextResponse.json({
        customer,
        orders: orders.map(o => ({
          id: o.id,
          createdAt: o.createdAt,
          totalAmount: o.totalAmount,
          discountAmount: o.discountAmount,
          paidAmount: o.paidAmount,
          waiterName: o.waiterUser?.name || 'Bilinmiyor',
          items: o.items.map(item => ({
            id: item.id,
            productName: item.productName,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
            selectedModifiers: item.selectedModifiers,
            note: item.note
          })),
          payments: o.payments.filter(p => p.customerId === customerId)
        })),
        collections: customerAuditLogs.map(l => ({
          id: l.id,
          createdAt: l.createdAt,
          description: l.description
        }))
      });
    }

    const customers = await db.customer.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(customers);
  } catch (error: any) {
    console.error('Müşteriler API Hatası:', error);
    return NextResponse.json({ error: 'Müşteriler yüklenemedi.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, id, name, phone, balance, amount, paymentMethod } = body;

    if (action === 'create') {
      if (!name || !phone) {
        return NextResponse.json({ error: 'Ad ve telefon zorunludur.' }, { status: 400 });
      }
      const newCustomer = await db.customer.create({
        data: { name, phone, balance: balance || 0.0 },
      });
      return NextResponse.json(newCustomer);
    }

    if (action === 'update') {
      if (!id) return NextResponse.json({ error: 'Müşteri ID gereklidir.' }, { status: 400 });
      const updated = await db.customer.update({
        where: { id },
        data: { name, phone, balance },
      });
      return NextResponse.json(updated);
    }

    if (action === 'delete') {
      if (!id) return NextResponse.json({ error: 'Müşteri ID gereklidir.' }, { status: 400 });
      // Soft delete
      const deleted = await db.customer.update({
        where: { id },
        data: { isActive: false },
      });
      return NextResponse.json(deleted);
    }

    if (action === 'collect') {
      if (!id || !amount || !paymentMethod) {
        return NextResponse.json({ error: 'ID, miktar ve ödeme yöntemi gereklidir.' }, { status: 400 });
      }
      const customer = await db.customer.findUnique({ where: { id } });
      if (!customer) return NextResponse.json({ error: 'Müşteri bulunamadı.' }, { status: 404 });

      // Bakiyeden tahsilatı düş
      const updated = await db.customer.update({
        where: { id },
        data: { balance: { decrement: amount } },
      });

      const manager = await db.user.findFirst({ where: { role: 'ADMIN' } });
      const fallbackUser = await db.user.findFirst();
      const actorUserId = manager ? manager.id : (fallbackUser ? fallbackUser.id : '');

      await db.auditLog.create({
        data: {
          actionType: 'DISCOUNT_APPLIED',
          description: `Cari Müşteri '${customer.name}' tahsilat alındı. Miktar: ${amount} TL (${paymentMethod === 'CASH' ? 'Nakit' : 'Kredi Kartı'})`,
          actorUserId: actorUserId,
        }
      });
      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: 'Geçersiz işlem.' }, { status: 400 });
  } catch (error: any) {
    console.error('Müşteriler POST API Hatası:', error);
    return NextResponse.json({ error: error.message || 'Müşteri işlemi başarısız.' }, { status: 500 });
  }
}
