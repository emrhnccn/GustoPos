import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    const dateFilter: any = {};
    if (startDateParam) {
      dateFilter.gte = new Date(startDateParam);
    }
    if (endDateParam) {
      dateFilter.lte = new Date(endDateParam);
    }

    const orderWhere: any = { status: 'PAID' };
    if (startDateParam || endDateParam) {
      orderWhere.updatedAt = dateFilter;
    }

    // 1. Kapatılmış (ödenmiş) tüm siparişleri ve ödemeleri getir
    const paidOrders = await db.order.findMany({
      where: orderWhere,
      include: {
        items: {
          where: { status: { in: ['ACTIVE', 'PAID'] } },
          include: { waiterUser: { select: { name: true } } }
        },
        payments: true,
        waiterUser: {
          select: { name: true }
        },
        customer: {
          select: { name: true }
        }
      },
    });

    // 2. Özet İstatistikler
    let totalRevenue = 0;
    let totalDiscounts = 0;
    const paymentMethods = {
      CASH: 0,
      CREDIT_CARD: 0,
      MEAL_CARD: 0,
      CARI: 0,
    };

    paidOrders.forEach((order) => {
      totalRevenue += order.paidAmount;
      totalDiscounts += order.discountAmount;

      order.payments.forEach((p) => {
        const method = p.paymentMethod as keyof typeof paymentMethods;
        if (paymentMethods[method] !== undefined) {
          paymentMethods[method] += p.amount;
        }
      });
    });

    // 3. Ürün Satış Sayıları & Kategori Ciro Dağılımı
    const productSalesMap = new Map<string, { name: string; quantity: number; total: number }>();
    const categorySalesMap = new Map<string, number>();

    // Bütün kategorileri çekip haritayı sıfırla dolduralım
    const categories = await db.category.findMany();
    categories.forEach((cat) => categorySalesMap.set(cat.name, 0));

    // Ürünleri de kategori isimleri için çekelim
    const products = await db.product.findMany({
      include: { category: true },
    });
    const productCategoryMap = new Map(products.map((p) => [p.id, p.category.name]));

    paidOrders.forEach((order) => {
      order.items.forEach((item) => {
        // Ürün satışı
        const currentProduct = productSalesMap.get(item.productId) || {
          name: item.productName,
          quantity: 0,
          total: 0,
        };
        currentProduct.quantity += item.quantity;
        currentProduct.total += item.unitPrice * item.quantity;
        productSalesMap.set(item.productId, currentProduct);

        // Kategori satışı
        const categoryName = productCategoryMap.get(item.productId) || 'Diğer';
        const currentCategoryTotal = categorySalesMap.get(categoryName) || 0;
        categorySalesMap.set(categoryName, currentCategoryTotal + item.unitPrice * item.quantity);
      });
    });

    // En çok satan ürünleri diziye çevirip sırala
    const topProducts = Array.from(productSalesMap.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    // Günlük satılan tüm ürünlerin tam konsolide listesi
    const productSalesSummary = Array.from(productSalesMap.values())
      .sort((a, b) => b.quantity - a.quantity);

    // Kategori ciro dağılımını diziye çevir
    const categorySales = Array.from(categorySalesMap.entries()).map(([name, value]) => ({
      name,
      value: Math.round(value * 100) / 100,
    }));

    // 4. Saatlik Yoğunluk Dağılımı (Peak Hours)
    const hourlySalesArray = Array.from({ length: 24 }, (_, i) => ({
      hour: `${i.toString().padStart(2, '0')}:00`,
      total: 0,
    }));

    paidOrders.forEach((order) => {
      const hour = new Date(order.createdAt).getHours();
      hourlySalesArray[hour].total += order.paidAmount;
    });

    // Yuvarlamaları yap
    hourlySalesArray.forEach((h) => {
      h.total = Math.round(h.total * 100) / 100;
    });

    // 5. Kritik Stok Uyarısı Veren Ürünler (Limit: 15)
    const stockWarnings = await db.product.findMany({
      where: {
        isStockControlled: true,
        stockLevel: { lte: 15 },
      },
      include: {
        category: true,
      },
    });

    // 6. Personel Performansı (Log sayılarına göre)
    const logWhere: any = {};
    if (startDateParam || endDateParam) {
      logWhere.createdAt = dateFilter;
    }
    
    const logs = await db.auditLog.findMany({
      where: logWhere,
      include: {
        actorUser: {
          select: { id: true, name: true, role: true }
        }
      }
    });
    const personnelMap = new Map<string, { name: string; role: string; actionsCount: number }>();
    logs.forEach((log) => {
      const user = log.actorUser;
      if (!user) return;
      const stats = personnelMap.get(user.id) || { name: user.name, role: user.role, actionsCount: 0 };
      stats.actionsCount += 1;
      personnelMap.set(user.id, stats);
    });
    const personnelPerformance = Array.from(personnelMap.values());

    // 7. Garson Satış Ciro Raporu (item düzeyinde hesaplama)
    const waiterPerformanceMap = new Map<string, { name: string; role: string; ordersCount: number; totalSales: number; items: {name: string, quantity: number, total: number}[] }>();
    
    // First count unique orders per waiter
    const waiterOrders = new Map<string, Set<string>>();
    
    paidOrders.forEach((order) => {
      order.items.forEach(item => {
        const userId = item.waiterUserId;
        const user = item.waiterUser;
        if (!userId || !user) return;
        
        // Track orders handled by waiter
        if (!waiterOrders.has(userId)) {
          waiterOrders.set(userId, new Set());
        }
        waiterOrders.get(userId)!.add(order.id);

        const name = user.name;
        const role = 'WAITER';

        const stats = waiterPerformanceMap.get(userId) || { name, role, ordersCount: 0, totalSales: 0, items: [] };
        
        const itemTotal = item.unitPrice * item.quantity;
        stats.totalSales += itemTotal;

        const existingItem = stats.items.find(i => i.name === item.productName);
        if (existingItem) {
          existingItem.quantity += item.quantity;
          existingItem.total += itemTotal;
        } else {
          stats.items.push({
            name: item.productName,
            quantity: item.quantity,
            total: itemTotal
          });
        }
        waiterPerformanceMap.set(userId, stats);
      });
    });
    
    // Update orders count and sort items
    const waiterSalesPerformance = Array.from(waiterPerformanceMap.values()).map(w => {
      // Find userId for this waiter to get orders count
      const entry = Array.from(waiterPerformanceMap.entries()).find(([_, val]) => val === w);
      if (entry) {
        w.ordersCount = waiterOrders.get(entry[0])?.size || 0;
      }
      w.items.sort((a, b) => b.quantity - a.quantity);
      return w;
    });

    // 8. Kapatılan Adisyon Günlüğü (Z Raporu listesi)
    const allTables = await db.table.findMany({ select: { id: true, name: true } });
    const tableMap = new Map(allTables.map((t) => [t.id, t.name]));

    const adisyonHistory = paidOrders.map((o) => ({
      id: o.id,
      tableName: tableMap.get(o.tableId) || 'Bilinmiyor',
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
      totalAmount: o.totalAmount,
      discountAmount: o.discountAmount,
      paidAmount: o.paidAmount,
      waiterName: o.waiterUser?.name || 'Masaüstü',
      customerName: o.customer?.name || null,
      items: o.items.map(item => ({
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        selectedModifiers: item.selectedModifiers
      }))
    })).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return NextResponse.json({
      summary: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalOrders: paidOrders.length,
        totalDiscounts: Math.round(totalDiscounts * 100) / 100,
      },
      paymentMethods: {
        cash: Math.round(paymentMethods.CASH * 100) / 100,
        creditCard: Math.round(paymentMethods.CREDIT_CARD * 100) / 100,
        mealCard: Math.round(paymentMethods.MEAL_CARD * 100) / 100,
        cari: Math.round(paymentMethods.CARI * 100) / 100,
      },
      topProducts,
      productSalesSummary,
      categorySales,
      hourlySales: hourlySalesArray,
      stockWarnings: stockWarnings.map((p) => ({
        id: p.id,
        name: p.name,
        categoryName: p.category.name,
        stockLevel: p.stockLevel,
      })),
      personnelPerformance,
      waiterSalesPerformance,
      adisyonHistory,
    });
  } catch (error: any) {
    console.error('Raporlama API Hatası:', error);
    return NextResponse.json(
      { error: 'Rapor verileri hesaplanırken hata oluştu.' },
      { status: 500 }
    );
  }
}
