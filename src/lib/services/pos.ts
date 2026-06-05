import { db } from '@/lib/db';

// Kuruş yuvarlama hatasını önlemek için yardımcı fonksiyon
const round = (num: number) => Math.round(num * 100) / 100;

export interface OrderItemInput {
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  note?: string;
  selectedModifiers?: Array<{ name: string; price: number }>;
}

/**
 * Bir masaya yeni sipariş kalemleri ekler. Eğer masada aktif bir sipariş yoksa yeni bir adisyon açar.
 */
export async function addOrderItems(
  tableId: string,
  items: OrderItemInput[],
  waiterUserId: string
) {
  return await db.$transaction(async (tx) => {
    const table = await tx.table.findUnique({ where: { id: tableId } });
    if (!table) throw new Error('Masa bulunamadı.');

    let orderId = table.activeOrderId;
    let order;

    // Aktif WorkDay kontrolü
    const activeWorkDay = await tx.workDay.findFirst({
      where: { status: 'OPEN' }
    });

    if (!activeWorkDay) {
      throw new Error('Gün başı yapılmamış! Lütfen önce gün başı işlemi yapın.');
    }

    if (!orderId) {
      // Yeni aktif sipariş oluştur
      order = await tx.order.create({
        data: {
          tableId: tableId,
          status: 'ACTIVE',
          totalAmount: 0,
          discountAmount: 0,
          paidAmount: 0,
          waiterUserId: waiterUserId,
          workDayId: activeWorkDay.id,
        },
      });
      orderId = order.id;

      // Masayı güncelle
      await tx.table.update({
        where: { id: tableId },
        data: {
          status: 'OCCUPIED',
          activeOrderId: orderId,
        },
      });
    } else {
      order = await tx.order.findUnique({ where: { id: orderId } });
    }

    if (!order) throw new Error('Aktif sipariş bulunamadı.');

    // Sipariş kalemlerini oluştur ve stok işlemlerini uygula
    for (const item of items) {
      await tx.orderItem.create({
        data: {
          orderId: orderId,
          productId: item.productId,
          productName: item.productName,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          note: item.note || null,
          status: 'ACTIVE',
          selectedModifiers: item.selectedModifiers ? JSON.stringify(item.selectedModifiers) : null,
          waiterUserId: waiterUserId,
        },
      });

      // Stok kontrollü ürünlerin stoğunu düşür
      const product = await tx.product.findUnique({ where: { id: item.productId } });
      if (product && product.isStockControlled) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stockLevel: {
              decrement: item.quantity,
            },
          },
        });

        await tx.stockTransaction.create({
          data: {
            productId: item.productId,
            quantityChanged: -item.quantity,
            transactionType: 'SALE',
          },
        });
      }
    }

    // Toplam tutarı güncelle
    await recalculateOrderTotal(tx, orderId);

    return { orderId };
  });
}

/**
 * Bir sipariş kalemini iptal eder. İptal sebebi ve onaylayan admin loglanır.
 */
export async function cancelOrderItem(
  orderItemId: string,
  quantityToCancel: number,
  cancelReason: string,
  adminUserId: string,
  waiterUserId: string
) {
  return await db.$transaction(async (tx) => {
    const item = await tx.orderItem.findUnique({
      where: { id: orderItemId },
      include: { order: true },
    });

    if (!item) throw new Error('Sipariş kalemi bulunamadı.');
    if (quantityToCancel > item.quantity) {
      throw new Error('İptal edilecek miktar mevcut miktardan fazla olamaz.');
    }

    const orderId = item.orderId;

    if (quantityToCancel === item.quantity) {
      // Kalemin tamamı iptal ediliyor
      await tx.orderItem.update({
        where: { id: orderItemId },
        data: {
          status: 'CANCELLED',
          cancelReason,
          cancelledByUserId: adminUserId,
        },
      });
    } else {
      // Kısmi iptal (Miktar azaltılır ve yeni bir iptal kaydı açılır)
      await tx.orderItem.update({
        where: { id: orderItemId },
        data: {
          quantity: item.quantity - quantityToCancel,
        },
      });

      await tx.orderItem.create({
        data: {
          orderId: orderId,
          productId: item.productId,
          productName: item.productName,
          unitPrice: item.unitPrice,
          quantity: quantityToCancel,
          note: item.note,
          status: 'CANCELLED',
          cancelReason,
          cancelledByUserId: adminUserId,
          waiterUserId: item.waiterUserId,
        },
      });
    }

    // Stok iadesi yap
    const product = await tx.product.findUnique({ where: { id: item.productId } });
    if (product && product.isStockControlled) {
      await tx.product.update({
        where: { id: item.productId },
        data: {
          stockLevel: {
            increment: quantityToCancel,
          },
        },
      });

      await tx.stockTransaction.create({
        data: {
          productId: item.productId,
          quantityChanged: quantityToCancel,
          transactionType: 'MANUAL_CORRECTION',
        },
      });
    }

    // Toplam tutarı güncelle
    await recalculateOrderTotal(tx, orderId);

    // Audit Log oluştur
    await tx.auditLog.create({
      data: {
        actionType: 'ITEM_CANCEL',
        description: `${quantityToCancel}x ${item.productName} iptal edildi. Gerekçe: ${cancelReason}`,
        orderId: orderId,
        actorUserId: waiterUserId,
        approverUserId: adminUserId,
      },
    });

    // Masadaki adisyonda aktif ürün kalmadıysa ve ödenen miktar da sıfırsa masayı boşalt
    const activeItemsCount = await tx.orderItem.count({
      where: { orderId, status: { in: ['ACTIVE', 'COMPLIMENTARY'] } },
    });

    if (activeItemsCount === 0) {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (order && order.paidAmount === 0) {
        await tx.order.update({
          where: { id: orderId },
          data: { status: 'CANCELLED' },
        });

        await tx.table.update({
          where: { id: item.order.tableId },
          data: { status: 'EMPTY', activeOrderId: null },
        });
      }
    }
  });
}

/**
 * Bir sipariş kalemini ikram (ücretsiz) olarak işaretler.
 */
export async function makeItemComplimentary(
  orderItemId: string,
  quantityToMakeComplimentary: number,
  adminUserId: string,
  waiterUserId: string
) {
  return await db.$transaction(async (tx) => {
    const item = await tx.orderItem.findUnique({
      where: { id: orderItemId },
    });

    if (!item) throw new Error('Sipariş kalemi bulunamadı.');
    if (quantityToMakeComplimentary > item.quantity) {
      throw new Error('İkram edilecek miktar mevcut miktardan fazla olamaz.');
    }

    const orderId = item.orderId;

    if (quantityToMakeComplimentary === item.quantity) {
      await tx.orderItem.update({
        where: { id: orderItemId },
        data: { status: 'COMPLIMENTARY' },
      });
    } else {
      // Kısmi İkram (Bölme işlemi)
      await tx.orderItem.update({
        where: { id: orderItemId },
        data: { quantity: item.quantity - quantityToMakeComplimentary },
      });

      await tx.orderItem.create({
        data: {
          orderId: orderId,
          productId: item.productId,
          productName: item.productName,
          unitPrice: item.unitPrice,
          quantity: quantityToMakeComplimentary,
          note: item.note,
          status: 'COMPLIMENTARY',
          waiterUserId: item.waiterUserId,
        },
      });
    }

    // Toplam tutarı güncelle (İkram edilen ürünlerin fiyatı toplamdan düşer)
    await recalculateOrderTotal(tx, orderId);

    // Audit log
    await tx.auditLog.create({
      data: {
        actionType: 'DISCOUNT_APPLIED',
        description: `${quantityToMakeComplimentary}x ${item.productName} ikram edildi.`,
        orderId: orderId,
        actorUserId: waiterUserId,
        approverUserId: adminUserId,
      },
    });
  });
}

/**
 * Adisyona yüzde veya tutar bazlı indirim uygular.
 */
export async function applyDiscount(
  orderId: string,
  discountType: 'percentage' | 'amount',
  value: number,
  adminUserId: string,
  waiterUserId: string
) {
  return await db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) throw new Error('Adisyon bulunamadı.');

    // Aktif (ücretli) ürünlerin ara toplamını hesapla
    const activeSubtotal = order.items
      .filter((item) => item.status === 'ACTIVE')
      .reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

    let calculatedDiscount = 0;

    if (discountType === 'percentage') {
      calculatedDiscount = round(activeSubtotal * (value / 100));
    } else {
      calculatedDiscount = round(value);
    }

    if (calculatedDiscount > activeSubtotal) {
      calculatedDiscount = activeSubtotal; // Ara toplamdan fazla indirim yapılamaz
    }

    await tx.order.update({
      where: { id: orderId },
      data: {
        discountAmount: calculatedDiscount,
        totalAmount: round(activeSubtotal - calculatedDiscount),
      },
    });

    // Audit log
    await tx.auditLog.create({
      data: {
        actionType: 'DISCOUNT_APPLIED',
        description: `Adisyona ${discountType === 'percentage' ? '%' + value : value + ' TL'} indirim uygulandı. Toplam indirim: ${calculatedDiscount} TL`,
        orderId: orderId,
        actorUserId: waiterUserId,
        approverUserId: adminUserId,
      },
    });
  });
}

/**
 * İki masanın adisyonunu birleştirir (Masa Birleştirme).
 */
export async function mergeTables(
  sourceTableId: string,
  targetTableId: string,
  adminUserId: string
) {
  return await db.$transaction(async (tx) => {
    const sourceTable = await tx.table.findUnique({
      where: { id: sourceTableId },
    });
    const targetTable = await tx.table.findUnique({
      where: { id: targetTableId },
    });

    if (!sourceTable || !sourceTable.activeOrderId) {
      throw new Error('Kaynak masada aktif bir adisyon bulunmuyor.');
    }
    if (!targetTable) {
      throw new Error('Hedef masa bulunamadı.');
    }

    const sourceOrder = await tx.order.findUnique({
      where: { id: sourceTable.activeOrderId },
      include: { items: true },
    });
    if (!sourceOrder) throw new Error('Kaynak adisyon kaydı bulunamadı.');

    // 1. Hedef masa boşsa: Basit masa transferi yap
    if (!targetTable.activeOrderId) {
      await tx.order.update({
        where: { id: sourceOrder.id },
        data: { tableId: targetTableId },
      });

      await tx.table.update({
        where: { id: targetTableId },
        data: {
          status: sourceTable.status,
          activeOrderId: sourceOrder.id,
        },
      });

      await tx.table.update({
        where: { id: sourceTableId },
        data: {
          status: 'EMPTY',
          activeOrderId: null,
        },
      });

      await tx.auditLog.create({
        data: {
          actionType: 'TABLE_TRANSFER',
          description: `${sourceTable.name} adisyonu boş olan ${targetTable.name} masasına taşındı.`,
          orderId: sourceOrder.id,
          actorUserId: adminUserId,
        },
      });
      return;
    }

    // 2. İki masa da doluysa: Adisyonları birleştir
    const targetOrder = await tx.order.findUnique({
      where: { id: targetTable.activeOrderId },
      include: { items: true },
    });
    if (!targetOrder) throw new Error('Hedef adisyon kaydı bulunamadı.');

    for (const item of sourceOrder.items) {
      // Hedefte aynı ürün, fiyat, not ve statüye sahip bir kalem var mı?
      const matchingTargetItem = targetOrder.items.find(
        (tItem) =>
          tItem.productId === item.productId &&
          tItem.unitPrice === item.unitPrice &&
          tItem.note === item.note &&
          tItem.status === item.status
      );

      if (matchingTargetItem) {
        // Miktarları birleştir
        await tx.orderItem.update({
          where: { id: matchingTargetItem.id },
          data: { quantity: matchingTargetItem.quantity + item.quantity },
        });
        // Kaynaktaki mükerrer kaydı sil
        await tx.orderItem.delete({ where: { id: item.id } });
      } else {
        // Doğrudan hedef siparişe bağla
        await tx.orderItem.update({
          where: { id: item.id },
          data: { orderId: targetOrder.id },
        });
      }
    }

    // İndirim, ödenen miktarları ve notları topla
    const newPaidAmount = round(targetOrder.paidAmount + sourceOrder.paidAmount);
    const newDiscountAmount = round(targetOrder.discountAmount + sourceOrder.discountAmount);

    // Kaynak siparişi sıfırla ve kapat (arşivle)
    await tx.order.update({
      where: { id: sourceOrder.id },
      data: {
        status: 'PAID',
        totalAmount: 0,
        paidAmount: 0,
        discountAmount: 0,
      },
    });

    // Kaynak masayı boşa çıkar
    await tx.table.update({
      where: { id: sourceTableId },
      data: {
        status: 'EMPTY',
        activeOrderId: null,
      },
    });

    // Hedef siparişin net toplamını hesapla ve güncelle
    await recalculateOrderTotal(tx, targetOrder.id);

    // Güncellenmiş hedef siparişe ödenen ve indirilen tutarları ata
    const reCalculatedOrder = await tx.order.findUnique({
      where: { id: targetOrder.id },
    });
    const subtotal = (reCalculatedOrder?.totalAmount || 0) + newDiscountAmount;

    await tx.order.update({
      where: { id: targetOrder.id },
      data: {
        discountAmount: newDiscountAmount,
        paidAmount: newPaidAmount,
        totalAmount: round(subtotal - newDiscountAmount),
        note: targetOrder.note
          ? `${targetOrder.note} | ${sourceTable.name} ile birleştirildi`
          : `${sourceTable.name} ile birleştirildi`,
      },
    });

    // Masaların statüsünü kontrol et (biri bile hesap istemişse hedef masayı HESAP İSTENDİ yap)
    const newStatus =
      sourceTable.status === 'BILL_REQUESTED' || targetTable.status === 'BILL_REQUESTED'
        ? 'BILL_REQUESTED'
        : 'OCCUPIED';

    await tx.table.update({
      where: { id: targetTableId },
      data: { status: newStatus },
    });

    // Audit log
    await tx.auditLog.create({
      data: {
        actionType: 'TABLE_MERGE',
        description: `${sourceTable.name} adisyonu ${targetTable.name} ile birleştirildi.`,
        orderId: targetOrder.id,
        actorUserId: adminUserId,
      },
    });
  });
}

/**
 * Bir masadan başka bir masaya seçilen kalemleri (veya bir kısmını) taşır. (Kısmi Ürün Aktarma)
 */
export async function transferPartialItems(
  sourceTableId: string,
  targetTableId: string,
  itemsToTransfer: Array<{ orderItemId: string; quantityToMove: number }>,
  waiterUserId: string
) {
  return await db.$transaction(async (tx) => {
    const sourceTable = await tx.table.findUnique({
      where: { id: sourceTableId },
    });
    let targetTable = await tx.table.findUnique({
      where: { id: targetTableId },
    });

    if (!sourceTable || !sourceTable.activeOrderId) {
      throw new Error('Kaynak masada aktif bir adisyon bulunamadı.');
    }
    if (!targetTable) {
      throw new Error('Hedef masa bulunamadı.');
    }

    const sourceOrder = await tx.order.findUnique({
      where: { id: sourceTable.activeOrderId },
      include: { items: true },
    });
    if (!sourceOrder) throw new Error('Kaynak adisyon kaydı bulunamadı.');

    let targetOrderId = targetTable.activeOrderId;
    let targetOrder = targetOrderId
      ? await tx.order.findUnique({
          where: { id: targetOrderId },
          include: { items: true },
        })
      : null;

    // Hedef masa boşsa yeni bir adisyon oluştur
    if (!targetOrderId || !targetOrder) {
      const newOrder = await tx.order.create({
        data: {
          tableId: targetTableId,
          status: 'ACTIVE',
          totalAmount: 0,
          discountAmount: 0,
          paidAmount: 0,
          workDayId: sourceOrder.workDayId,
        },
      });
      targetOrderId = newOrder.id;

      targetTable = await tx.table.update({
        where: { id: targetTableId },
        data: {
          status: 'OCCUPIED',
          activeOrderId: targetOrderId,
        },
      });
      
      targetOrder = await tx.order.findUnique({
        where: { id: targetOrderId },
        include: { items: true },
      });
    }

    if (!targetOrder) throw new Error('Hedef adisyon kaydı oluşturulamadı.');

    const transferDetails: string[] = [];

    for (const transferInfo of itemsToTransfer) {
      const sourceItem = sourceOrder.items.find((i) => i.id === transferInfo.orderItemId);
      if (!sourceItem) throw new Error('Aktarılacak ürün kaynak adisyonda bulunamadı.');
      if (transferInfo.quantityToMove > sourceItem.quantity) {
        throw new Error(`Mevcut miktardan (${sourceItem.quantity}) fazlası aktarılamaz.`);
      }

      // Hedefte benzer bir aktif ürün kalemi var mı?
      const matchingTargetItem = targetOrder.items.find(
        (tItem) =>
          tItem.productId === sourceItem.productId &&
          tItem.unitPrice === sourceItem.unitPrice &&
          tItem.note === sourceItem.note &&
          tItem.status === sourceItem.status
      );

      if (transferInfo.quantityToMove === sourceItem.quantity) {
        // Kalemin tamamını taşı (OrderId değiştirilerek)
        if (matchingTargetItem) {
          await tx.orderItem.update({
            where: { id: matchingTargetItem.id },
            data: { quantity: matchingTargetItem.quantity + sourceItem.quantity },
          });
          await tx.orderItem.delete({ where: { id: sourceItem.id } });
        } else {
          await tx.orderItem.update({
            where: { id: sourceItem.id },
            data: { orderId: targetOrderId },
          });
        }
      } else {
        // Kısmi miktar azalt ve yeni sipariş kalemi aç
        await tx.orderItem.update({
          where: { id: sourceItem.id },
          data: { quantity: sourceItem.quantity - transferInfo.quantityToMove },
        });

        if (matchingTargetItem) {
          await tx.orderItem.update({
            where: { id: matchingTargetItem.id },
            data: { quantity: matchingTargetItem.quantity + transferInfo.quantityToMove },
          });
        } else {
          await tx.orderItem.create({
            data: {
              orderId: targetOrderId,
              productId: sourceItem.productId,
              productName: sourceItem.productName,
              unitPrice: sourceItem.unitPrice,
              quantity: transferInfo.quantityToMove,
              note: sourceItem.note,
              status: sourceItem.status,
              waiterUserId: sourceItem.waiterUserId,
            },
          });
        }
      }

      transferDetails.push(`${transferInfo.quantityToMove}x ${sourceItem.productName}`);
    }

    // Toplam tutarları yeniden hesapla
    await recalculateOrderTotal(tx, sourceOrder.id);
    await recalculateOrderTotal(tx, targetOrderId);

    // Kaynak adisyonda hiç aktif sipariş kalmadıysa adisyonu kapat ve masayı boşa çıkar
    const remainingActiveItems = await tx.orderItem.count({
      where: { orderId: sourceOrder.id, status: { in: ['ACTIVE', 'COMPLIMENTARY'] } },
    });

    if (remainingActiveItems === 0) {
      await tx.order.update({
        where: { id: sourceOrder.id },
        data: { status: 'PAID' },
      });
      await tx.table.update({
        where: { id: sourceTableId },
        data: {
          status: 'EMPTY',
          activeOrderId: null,
        },
      });
    }

    // Audit log
    await tx.auditLog.create({
      data: {
        actionType: 'TABLE_TRANSFER',
        description: `${sourceTable.name} masasından ${targetTable.name} masasına ürünler aktarıldı: ${transferDetails.join(', ')}`,
        orderId: sourceOrder.id,
        actorUserId: waiterUserId,
      },
    });
  });
}

/**
 * Parçalı ödemeyi adisyona yansıtır. Bakiye kapandığında masayı otomatik boşaltır.
 */
export async function addSplitPayment(
  tableId: string,
  amount: number,
  paymentMethod: 'CASH' | 'CREDIT_CARD' | 'MEAL_CARD' | 'CARI',
  customerId?: string
) {
  return await db.$transaction(async (tx) => {
    const table = await tx.table.findUnique({
      where: { id: tableId },
    });

    if (!table || !table.activeOrderId) {
      throw new Error('Masada aktif bir adisyon bulunamadı.');
    }

    const order = await tx.order.findUnique({
      where: { id: table.activeOrderId },
    });

    if (!order) {
      throw new Error('Adisyon kaydı bulunamadı.');
    }

    const remainingBalance = round(order.totalAmount - order.paidAmount);

    if (amount > remainingBalance + 0.01) {
      throw new Error(
        `Ödeme tutarı kalan bakiyeyi aşıyor. Maksimum ödenebilir: ${remainingBalance} TL`
      );
    }

    // Ödeme kaydı ekle
    await tx.payment.create({
      data: {
        orderId: order.id,
        amount: amount,
        paymentMethod: paymentMethod,
        customerId: customerId || null,
      },
    });

    // Cari ödemeyse müşterinin borç bakiyesini artır
    if (paymentMethod === 'CARI') {
      if (!customerId) throw new Error('Cari ödeme için müşteri seçilmelidir.');
      await tx.customer.update({
        where: { id: customerId },
        data: {
          balance: {
            increment: amount,
          },
        },
      });
      // Siparişe customerId bağla
      await tx.order.update({
        where: { id: order.id },
        data: { customerId: customerId },
      });
    }

    // Ödenen tutarı güncelle
    const updatedPaidAmount = round(order.paidAmount + amount);
    const newRemaining = round(order.totalAmount - updatedPaidAmount);

    await tx.order.update({
      where: { id: order.id },
      data: {
        paidAmount: updatedPaidAmount,
      },
    });

    // Hesap tamamen kapandı mı? (0.01 TL hassasiyet payı ile)
    if (newRemaining <= 0.01) {
      // Bütün active order item'ları PAID durumuna çekelim ki arşive düzgün gitsin
      await tx.orderItem.updateMany({
        where: { orderId: order.id, status: 'ACTIVE' },
        data: { status: 'PAID' }
      });

      await tx.order.update({
        where: { id: order.id },
        data: { status: 'PAID' },
      });

      await tx.table.update({
        where: { id: tableId },
        data: {
          status: 'EMPTY',
          activeOrderId: null,
        },
      });

      return { remaining: 0, isClosed: true };
    }

    return { remaining: newRemaining, isClosed: false };
  });
}

/**
 * Belirli kalemlerin (veya bir kısmının) ödemesini yapar (Alman Usulü Kısmi Ödeme).
 */
export async function payPartialItems(
  tableId: string,
  itemsToPay: Array<{ orderItemId: string; quantityToPay: number }>,
  paymentMethod: 'CASH' | 'CREDIT_CARD' | 'MEAL_CARD' | 'CARI',
  customerId?: string
) {
  return await db.$transaction(async (tx) => {
    const table = await tx.table.findUnique({ where: { id: tableId } });
    if (!table || !table.activeOrderId) throw new Error('Masada aktif adisyon bulunamadı.');
    const orderId = table.activeOrderId;
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true }
    });
    if (!order) throw new Error('Adisyon bulunamadı.');

    let totalPaymentAmount = 0;

    for (const payInfo of itemsToPay) {
      const item = order.items.find(i => i.id === payInfo.orderItemId);
      if (!item) throw new Error('Ödenecek ürün adisyonda bulunamadı.');
      if (item.status === 'PAID') throw new Error('Ödenmiş ürün tekrar ödenemez.');
      if (payInfo.quantityToPay > item.quantity) {
        throw new Error('Ödenecek miktar mevcut miktardan fazla olamaz.');
      }

      const modifiers = item.selectedModifiers ? JSON.parse(item.selectedModifiers) : [];
      const modifiersTotal = modifiers.reduce((mSum: number, m: any) => mSum + m.price, 0);
      const singleItemPrice = item.unitPrice + modifiersTotal;
      const itemPaidPrice = singleItemPrice * payInfo.quantityToPay;
      totalPaymentAmount += itemPaidPrice;

      if (payInfo.quantityToPay === item.quantity) {
        // Tamamını öde
        await tx.orderItem.update({
          where: { id: item.id },
          data: { status: 'PAID' }
        });
      } else {
        // Kısmi öde - Kalemi böl
        // 1. Mevcut kalemi azalt (ACTIVE olarak kalır)
        await tx.orderItem.update({
          where: { id: item.id },
          data: { quantity: item.quantity - payInfo.quantityToPay }
        });
        // 2. Yeni PAID kalemi oluştur
        await tx.orderItem.create({
          data: {
            orderId: order.id,
            productId: item.productId,
            productName: item.productName,
            unitPrice: item.unitPrice,
            quantity: payInfo.quantityToPay,
            note: item.note,
            status: 'PAID',
            selectedModifiers: item.selectedModifiers,
            createdAt: item.createdAt
          }
        });
      }
    }

    // Ödeme kaydı ekle
    await tx.payment.create({
      data: {
        orderId: order.id,
        amount: totalPaymentAmount,
        paymentMethod: paymentMethod,
        customerId: customerId || null
      }
    });

    // Cari ödemeyse müşterinin borç bakiyesini artır
    if (paymentMethod === 'CARI') {
      if (!customerId) throw new Error('Cari ödeme için müşteri seçilmelidir.');
      await tx.customer.update({
        where: { id: customerId },
        data: {
          balance: {
            increment: totalPaymentAmount
          }
        }
      });
      // Siparişe customerId bağla
      await tx.order.update({
        where: { id: order.id },
        data: { customerId }
      });
    }

    // paidAmount güncelle
    const updatedPaidAmount = round(order.paidAmount + totalPaymentAmount);
    await tx.order.update({
      where: { id: order.id },
      data: { paidAmount: updatedPaidAmount }
    });

    // recalculate total
    await recalculateOrderTotal(tx, order.id);

    // Masayı kapatacak mıyız? Kalan tutar 0 ise
    const reCalculatedOrder = await tx.order.findUnique({
      where: { id: order.id },
      include: { items: true }
    });
    const remainingBalance = round((reCalculatedOrder?.totalAmount || 0) - (reCalculatedOrder?.paidAmount || 0));

    // Veya aktif / complimentary ürün kalmadıysa
    const remainingActiveCount = reCalculatedOrder?.items.filter(i => i.status === 'ACTIVE' || i.status === 'COMPLIMENTARY').length || 0;

    if (remainingActiveCount === 0 || remainingBalance <= 0.01) {
      await tx.order.update({
        where: { id: order.id },
        data: { status: 'PAID' }
      });
      await tx.table.update({
        where: { id: tableId },
        data: {
          status: 'EMPTY',
          activeOrderId: null
        }
      });
      return { remaining: 0, isClosed: true };
    }

    return { remaining: remainingBalance, isClosed: false };
  });
}

/**
 * Masanın durumunu hesap istendi olarak günceller.
 */
export async function requestTableBill(tableId: string) {
  return await db.table.update({
    where: { id: tableId },
    data: { status: 'BILL_REQUESTED' },
  });
}

/**
 * Sipariş toplam tutarını (net) ara toplamdan indirim miktarını düşerek yeniden hesaplar.
 */
async function recalculateOrderTotal(tx: any, orderId: string): Promise<void> {
  const chargeableItems = await tx.orderItem.findMany({
    where: {
      orderId,
      status: { in: ['ACTIVE', 'PAID'] }
    },
  });

  const subtotal = chargeableItems.reduce(
    (sum: number, item: any) => {
      const modifiers = item.selectedModifiers ? JSON.parse(item.selectedModifiers) : [];
      const modifiersTotal = modifiers.reduce((mSum: number, m: any) => mSum + m.price, 0);
      return sum + (item.unitPrice + modifiersTotal) * item.quantity;
    },
    0
  );

  const order = await tx.order.findUnique({ where: { id: orderId } });
  if (!order) return;

  // İndirim miktarının alt toplamdan fazla olmamasını sağla
  let discount = order.discountAmount;
  if (discount > subtotal) {
    discount = subtotal;
  }

  await tx.order.update({
    where: { id: orderId },
    data: {
      discountAmount: discount,
      totalAmount: round(subtotal - discount),
    },
  });
}
