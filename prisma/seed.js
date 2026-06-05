const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Veritabanı temizleniyor...');
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.table.deleteMany();
  await prisma.stockTransaction.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.modifier.deleteMany();

  console.log('Kullanıcılar ekleniyor...');
  const waiter1 = await prisma.user.create({
    data: { name: 'Ahmet Yılmaz', pinHash: '1111', role: 'WAITER' }
  });
  const waiter2 = await prisma.user.create({
    data: { name: 'Ayşe Kaya', pinHash: '2222', role: 'WAITER' }
  });
  const manager = await prisma.user.create({
    data: { name: 'Müdür Can', pinHash: '0000', role: 'ADMIN' }
  });

  console.log('Cari Müşteriler ekleniyor...');
  const cust1 = await prisma.customer.create({
    data: { name: 'Mehmet Kaya', phone: '0532 111 2233', balance: 450.0 }
  });
  const cust2 = await prisma.customer.create({
    data: { name: 'Canan Demir', phone: '0542 222 3344', balance: 120.0 }
  });
  const cust3 = await prisma.customer.create({
    data: { name: 'Selin Şahin', phone: '0555 333 4455', balance: 0.0 }
  });

  console.log('Kategoriler ekleniyor...');
  const catBreakfast = await prisma.category.create({
    data: { name: 'Güne Başlarken', sortOrder: 1 }
  });
  const catToasts = await prisma.category.create({
    data: { name: 'Tostlar', sortOrder: 2 }
  });
  const catDrinksHot = await prisma.category.create({
    data: { name: 'Çaylar & Kahveler', sortOrder: 3 }
  });
  const catDrinksCold = await prisma.category.create({
    data: { name: 'Soğuk İçecekler', sortOrder: 4 }
  });
  const catDesserts = await prisma.category.create({
    data: { name: 'Tatlılar', sortOrder: 5 }
  });

  console.log('Ürünler ekleniyor...');
  const pSerpme = await prisma.product.create({
    data: { name: 'Serpme Kahvaltı', price: 380.0, categoryId: catBreakfast.id, isStockControlled: false }
  });
  const pTekKisilik = await prisma.product.create({
    data: { name: 'Tek Kişilik Kahvaltı', price: 220.0, categoryId: catBreakfast.id, isStockControlled: false }
  });
  const pMenemen = await prisma.product.create({
    data: { name: 'Menemen', price: 110.0, categoryId: catBreakfast.id, isStockControlled: false }
  });

  const pKarisikTost = await prisma.product.create({
    data: { name: 'Karışık Tost', price: 95.0, categoryId: catToasts.id, isStockControlled: false }
  });
  const pKasarliTost = await prisma.product.create({
    data: { name: 'Kaşarlı Tost', price: 85.0, categoryId: catToasts.id, isStockControlled: false }
  });
  const pAyvalikTostu = await prisma.product.create({
    data: { name: 'Ayvalık Tostu', price: 130.0, categoryId: catToasts.id, isStockControlled: false }
  });

  const pBardakCay = await prisma.product.create({
    data: { name: 'Bardak Çay', price: 25.0, categoryId: catDrinksHot.id, isStockControlled: true, stockLevel: 200 }
  });
  const pSemaverCay = await prisma.product.create({
    data: { name: 'Semaver Çay', price: 120.0, categoryId: catDrinksHot.id, isStockControlled: true, stockLevel: 50 }
  });
  const pFincanCay = await prisma.product.create({
    data: { name: 'Fincan Çay', price: 40.0, categoryId: catDrinksHot.id }
  });
  const pTurkKahvesi = await prisma.product.create({
    data: { name: 'Türk Kahvesi', price: 65.0, categoryId: catDrinksHot.id }
  });
  const pLatte = await prisma.product.create({
    data: { name: 'Latte', price: 80.0, categoryId: catDrinksHot.id }
  });

  const pCola = await prisma.product.create({
    data: { name: 'Coca-Cola', price: 45.0, categoryId: catDrinksCold.id, isStockControlled: true, stockLevel: 100 }
  });
  const pLimonata = await prisma.product.create({
    data: { name: 'Limonata', price: 60.0, categoryId: catDrinksCold.id, isStockControlled: false }
  });
  const pPortakal = await prisma.product.create({
    data: { name: 'Taze Portakal Suyu', price: 75.0, categoryId: catDrinksCold.id, isStockControlled: false }
  });
  const pSu = await prisma.product.create({
    data: { name: 'Su', price: 15.0, categoryId: catDrinksCold.id, isStockControlled: true, stockLevel: 500 }
  });

  const pSanSebastian = await prisma.product.create({
    data: { name: 'San Sebastian', price: 120.0, categoryId: catDesserts.id, isStockControlled: false }
  });
  const pBaklava = await prisma.product.create({
    data: { name: 'Fıstıklı Baklava', price: 140.0, categoryId: catDesserts.id, isStockControlled: false }
  });
  const pWaffle = await prisma.product.create({
    data: { name: 'Waffle', price: 135.0, categoryId: catDesserts.id, isStockControlled: false }
  });

  console.log('Ekstra Seçenekler (Modifiers) ekleniyor...');
  // Coffee modifiers (Sütlü, Büyük Boy, Double Shot, Yulaf Sütü) -> Türk Kahvesi, Latte
  await prisma.modifier.create({
    data: {
      name: 'Sütlü',
      price: 15.0,
      products: { connect: [{ id: pTurkKahvesi.id }, { id: pLatte.id }] }
    }
  });
  await prisma.modifier.create({
    data: {
      name: 'Büyük Boy',
      price: 20.0,
      products: { connect: [{ id: pTurkKahvesi.id }, { id: pLatte.id }] }
    }
  });
  await prisma.modifier.create({
    data: {
      name: 'Double Shot',
      price: 25.0,
      products: { connect: [{ id: pTurkKahvesi.id }, { id: pLatte.id }] }
    }
  });
  await prisma.modifier.create({
    data: {
      name: 'Yulaf Sütü',
      price: 20.0,
      products: { connect: [{ id: pTurkKahvesi.id }, { id: pLatte.id }] }
    }
  });

  // Tea modifiers (Demli, Açık, Limonlu) -> Bardak Çay, Fincan Çay, Semaver Çay
  await prisma.modifier.create({
    data: {
      name: 'Demli',
      price: 0.0,
      products: { connect: [{ id: pBardakCay.id }, { id: pFincanCay.id }, { id: pSemaverCay.id }] }
    }
  });
  await prisma.modifier.create({
    data: {
      name: 'Açık',
      price: 0.0,
      products: { connect: [{ id: pBardakCay.id }, { id: pFincanCay.id }, { id: pSemaverCay.id }] }
    }
  });
  await prisma.modifier.create({
    data: {
      name: 'Limonlu',
      price: 10.0,
      products: { connect: [{ id: pBardakCay.id }, { id: pFincanCay.id }, { id: pSemaverCay.id }] }
    }
  });

  // Toast modifiers (Ekstra Peynirli, Acılı) -> Karışık Tost, Kaşarlı Tost, Ayvalık Tostu
  await prisma.modifier.create({
    data: {
      name: 'Ekstra Peynirli',
      price: 30.0,
      products: { connect: [{ id: pKarisikTost.id }, { id: pKasarliTost.id }, { id: pAyvalikTostu.id }] }
    }
  });
  await prisma.modifier.create({
    data: {
      name: 'Acılı',
      price: 0.0,
      products: { connect: [{ id: pKarisikTost.id }, { id: pKasarliTost.id }, { id: pAyvalikTostu.id }] }
    }
  });


  console.log('Masalar (Floor Plan) ekleniyor...');
  const tableData = [
    // Bahçe masaları
    { name: 'B-1', area: 'Bahçe', sortOrder: 1 },
    { name: 'B-2', area: 'Bahçe', sortOrder: 2 },
    { name: 'B-3', area: 'Bahçe', sortOrder: 3 },
    { name: 'B-4', area: 'Bahçe', sortOrder: 4 },
    { name: 'B-5', area: 'Bahçe', sortOrder: 5 },

    // Açık Alan masaları
    { name: 'Açık-1', area: 'Açık', sortOrder: 1 },
    { name: 'Açık-2', area: 'Açık', sortOrder: 2 },
    { name: 'Açık-3', area: 'Açık', sortOrder: 3 },
    { name: 'Açık-4', area: 'Açık', sortOrder: 4 },

    // Üst Kat masaları
    { name: 'Üst-1', area: 'Üst Kat', sortOrder: 1 },
    { name: 'Üst-2', area: 'Üst Kat', sortOrder: 2 },
    { name: 'Üst-3', area: 'Üst Kat', sortOrder: 3 },

    // Localar
    { name: 'Loca-1', area: 'Loca', sortOrder: 1 },
    { name: 'Loca-2', area: 'Loca', sortOrder: 2 },

    // Teras masaları
    { name: 'Teras-1', area: 'Teras', sortOrder: 1 },
    { name: 'Teras-2', area: 'Teras', sortOrder: 2 },
    { name: 'Teras-3', area: 'Teras', sortOrder: 3 },

    // Diğer masalar
    { name: 'M-1', area: 'Diğer', sortOrder: 1 },
    { name: 'M-2', area: 'Diğer', sortOrder: 2 }
  ];

  for (const t of tableData) {
    await prisma.table.create({
      data: {
        name: t.name,
        area: t.area,
        status: 'EMPTY',
        sortOrder: t.sortOrder
      }
    });
  }

  // Cari hesap ve geçmiş ödemeleri göstermek adına örnek bir kapalı sipariş ekleyelim (Analiz Dashboard için)
  console.log('Analiz verileri için geçmiş sipariş simülasyonu...');
  const sampleOrder = await prisma.order.create({
    data: {
      tableId: (await prisma.table.findFirst({ where: { name: 'M-1' } })).id,
      status: 'PAID',
      totalAmount: 260.0,
      discountAmount: 20.0,
      paidAmount: 260.0,
      waiterUserId: waiter1.id,
      createdAt: new Date(Date.now() - 3600000 * 4), // 4 saat önce
      updatedAt: new Date(Date.now() - 3600000 * 3.5),
      payments: {
        create: [
          { amount: 150.0, paymentMethod: 'CREDIT_CARD', createdAt: new Date(Date.now() - 3600000 * 3.5) },
          { amount: 110.0, paymentMethod: 'CASH', createdAt: new Date(Date.now() - 3600000 * 3.5) }
        ]
      }
    }
  });

  const sampleProd1 = await prisma.product.findFirst({ where: { name: 'Menemen' } });
  const sampleProd2 = await prisma.product.findFirst({ where: { name: 'Serpme Kahvaltı' } });

  await prisma.orderItem.createMany({
    data: [
      {
        orderId: sampleOrder.id,
        productId: sampleProd1.id,
        productName: sampleProd1.name,
        unitPrice: sampleProd1.price,
        quantity: 1,
        status: 'PAID',
        createdAt: new Date(Date.now() - 3600000 * 4)
      },
      {
        orderId: sampleOrder.id,
        productId: sampleProd2.id,
        productName: sampleProd2.name,
        unitPrice: sampleProd2.price,
        quantity: 1,
        status: 'PAID',
        createdAt: new Date(Date.now() - 3600000 * 4)
      }
    ]
  });

  // Cari ekstre testi için Mehmet Kaya (cust1) adına bir veresiye adisyon simüle edelim
  const tableB1 = await prisma.table.findFirst({ where: { name: 'B-1' } });
  const sampleProd3 = await prisma.product.findFirst({ where: { name: 'Karışık Tost' } });
  const sampleProd4 = await prisma.product.findFirst({ where: { name: 'Türk Kahvesi' } });

  const cariOrder = await prisma.order.create({
    data: {
      tableId: tableB1.id,
      status: 'PAID',
      totalAmount: 185.0,
      discountAmount: 0.0,
      paidAmount: 185.0,
      customerId: cust1.id,
      waiterUserId: waiter2.id,
      createdAt: new Date(Date.now() - 3600000 * 2), // 2 saat önce
      updatedAt: new Date(Date.now() - 3600000 * 1.8),
      payments: {
        create: [
          { amount: 185.0, paymentMethod: 'CARI', customerId: cust1.id, createdAt: new Date(Date.now() - 3600000 * 1.8) }
        ]
      }
    }
  });

  await prisma.orderItem.createMany({
    data: [
      {
        orderId: cariOrder.id,
        productId: sampleProd3.id,
        productName: sampleProd3.name,
        unitPrice: sampleProd3.price,
        quantity: 1,
        status: 'PAID',
        createdAt: new Date(Date.now() - 3600000 * 2)
      },
      {
        orderId: cariOrder.id,
        productId: sampleProd4.id,
        productName: sampleProd4.name,
        unitPrice: sampleProd4.price,
        quantity: 1,
        status: 'PAID',
        selectedModifiers: JSON.stringify([{ name: 'Double Shot', price: 25.0 }]),
        createdAt: new Date(Date.now() - 3600000 * 2)
      }
    ]
  });

  // Ahmet Garson adına log defterini dolduralım
  await prisma.auditLog.create({
    data: {
      actionType: 'ITEM_CANCEL',
      description: '1x Limonata iptal edildi. Gerekçe: Müşteri vazgeçti',
      orderId: sampleOrder.id,
      actorUserId: waiter1.id,
      approverUserId: manager.id,
      createdAt: new Date(Date.now() - 3600000 * 3.8)
    }
  });

  console.log('Seed işlemi başarıyla tamamlandı!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
