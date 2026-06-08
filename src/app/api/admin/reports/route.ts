import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const workDayIdParam = searchParams.get('workDayId');

    const dateFilter: any = {};
    if (startDateParam) {
      dateFilter.gte = new Date(startDateParam);
    }
    if (endDateParam) {
      dateFilter.lte = new Date(endDateParam);
    }

    const orderWhere: any = { status: 'PAID' };
    if (workDayIdParam) {
      orderWhere.workDayId = workDayIdParam;
    } else if (startDateParam || endDateParam) {
      orderWhere.updatedAt = dateFilter;
    } else {
      // Varsayılan: Aktif açık günü bul ve sadece onun siparişlerini göster
      const activeWorkDay = await db.workDay.findFirst({
        where: { status: 'OPEN' }
      });
      if (activeWorkDay) {
        orderWhere.workDayId = activeWorkDay.id;
      } else {
        // Açık gün yoksa ve filtre de yoksa ciro sıfır gözükmesi için boş dönelim
        orderWhere.workDayId = 'non-existent-active-workday';
      }
    }

    // 1. Kapatılmış (ödenmiş) tüm siparişleri, kategorileri, ürünleri ve masaları paralel olarak çek
    const [paidOrders, categories, products, allTables] = await Promise.all([
      db.order.findMany({
        where: orderWhere,
        include: {
          items: {
            where: { status: { in: ['ACTIVE', 'PAID'] } },
            include: { waiterUser: { select: { name: true } } }
          },
          payments: true,
          waiterUser: { select: { name: true } },
          customer: { select: { name: true } }
        },
      }),
      db.category.findMany(),
      db.product.findMany({ include: { category: true } }),
      db.table.findMany({ select: { id: true, name: true } }),
    ]);

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

    // Bütün kategorileri haritayı sıfırla dolduralım
    categories.forEach((cat) => categorySalesMap.set(cat.name, 0));

    // Ürünleri kategori isimleri için haritaya al
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

    // 5. Kritik Stok Uyarısı Veren Ürünler (Limit: 15) - paralel çekildi (yukarıda)
    // stockWarnings sorgusu burada ayrı çekilecek (koşulu farklı olduğu için Promise.all'a eklenemiyor)
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
    if (workDayIdParam) {
      const targetWorkDay = await db.workDay.findUnique({
        where: { id: workDayIdParam }
      });
      if (targetWorkDay) {
        logWhere.createdAt = {
          gte: targetWorkDay.startTime,
          lte: targetWorkDay.endTime || new Date()
        };
      } else {
        logWhere.id = 'non-existent-log-id';
      }
    } else if (startDateParam || endDateParam) {
      logWhere.createdAt = dateFilter;
    } else {
      // Varsayılan: Aktif açık günü bul
      const activeWorkDay = await db.workDay.findFirst({
        where: { status: 'OPEN' }
      });
      if (activeWorkDay) {
        logWhere.createdAt = {
          gte: activeWorkDay.startTime,
          lte: new Date()
        };
      } else {
        logWhere.id = 'non-existent-log-id'; // empty logs if no active day
      }
    }
    
    // 6 & 11 & 12. Personel logları, iptal ve indirim loglarını paralel çek
    const [logs, cancellationLogs, discountLogs] = await Promise.all([
      db.auditLog.findMany({
        where: logWhere,
        include: {
          actorUser: { select: { id: true, name: true, role: true } }
        }
      }),
      db.auditLog.findMany({
        where: { ...logWhere, actionType: { in: ['ITEM_CANCEL', 'ORDER_CANCEL'] } },
        include: {
          actorUser: { select: { name: true, role: true } },
          approverUser: { select: { name: true, role: true } }
        },
        orderBy: { createdAt: 'desc' }
      }),
      db.auditLog.findMany({
        where: { ...logWhere, actionType: 'DISCOUNT_APPLIED' },
        include: {
          actorUser: { select: { name: true, role: true } },
          approverUser: { select: { name: true, role: true } }
        },
        orderBy: { createdAt: 'desc' }
      }),
    ]);
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

    // 8. Kapatılan Adisyon Günlüğü (Z Raporu listesi) - allTables paralelde çekildi
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

    // 9. En Çok Tercih Edilen Masalar (Top 5 Tables)
    const tablePerformanceMap = new Map<string, { name: string; orderCount: number; totalRevenue: number }>();
    paidOrders.forEach((order) => {
      const tableName = tableMap.get(order.tableId) || 'Bilinmiyor';
      const stats = tablePerformanceMap.get(order.tableId) || { name: tableName, orderCount: 0, totalRevenue: 0 };
      stats.orderCount += 1;
      stats.totalRevenue += order.paidAmount;
      tablePerformanceMap.set(order.tableId, stats);
    });

    const topTables = Array.from(tablePerformanceMap.values())
      .sort((a, b) => b.orderCount - a.orderCount)
      .slice(0, 5)
      .map(t => ({
        name: t.name,
        orderCount: t.orderCount,
        totalRevenue: Math.round(t.totalRevenue * 100) / 100
      }));

    // 10. Reçete Maliyet Analizi & Kâr Marjları
    const allProducts = await db.product.findMany({
      where: { isActive: true },
      include: {
        recipeItems: {
          include: { ingredient: true }
        }
      }
    });

    const productCostMap = new Map<string, number>();
    const costAnalysis = allProducts.map((p) => {
      let unitCost = 0;
      p.recipeItems.forEach((ri) => {
        const wasteCoeff = 1 + ri.wastePercentage / 100;
        unitCost += ri.quantityRequired * ri.ingredient.costPerUnit * wasteCoeff;
      });
      unitCost = Math.round(unitCost * 100) / 100;
      productCostMap.set(p.id, unitCost);

      const margin = p.price - unitCost;
      const marginPercentage = p.price > 0 ? Math.round((margin / p.price) * 100) : 0;

      return {
        id: p.id,
        name: p.name,
        price: p.price,
        cost: unitCost,
        margin: Math.round(margin * 100) / 100,
        marginPercentage
      };
    });

    // Satılan Malın Maliyeti (COGS) Hesabı
    let totalCogs = 0;
    paidOrders.forEach((order) => {
      order.items.forEach((item) => {
        const unitCost = productCostMap.get(item.productId) || 0;
        totalCogs += unitCost * item.quantity;
      });
    });
    totalCogs = Math.round(totalCogs * 100) / 100;

    // 11 & 12. İptal ve İndirim Raporları - yukarıda Promise.all ile paralel çekildi

    return NextResponse.json({
      summary: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalOrders: paidOrders.length,
        totalDiscounts: Math.round(totalDiscounts * 100) / 100,
        totalCogs,
        netProfit: Math.round((totalRevenue - totalCogs) * 100) / 100
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
      topTables,
      costAnalysis,
      cancellationLogs,
      discountLogs
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Raporlama API Hatası:', err);
    return NextResponse.json(
      { error: 'Rapor verileri hesaplanırken hata oluştu.' },
      { status: 500 }
    );
  }
}
