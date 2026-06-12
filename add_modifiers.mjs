import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const modifierDefinitions = [
  {
    category: 'Çay',
    keywords: ['çay', 'fincan çay', 'bitki çayı', 'kış çayı', 'adaçayı', 'ıhlamur', 'yeşil çay'],
    modifiers: ['Açık', 'Normal', 'Demli', 'Şekersiz', 'Az Şekerli', 'Orta Şekerli', 'Çok Şekerli', 'Limonlu']
  },
  {
    category: 'Türk Kahvesi',
    keywords: ['türk kahvesi', 'dibek kahvesi', 'menengiç kahvesi'],
    modifiers: ['Sade', 'Az Şekerli', 'Orta Şekerli', 'Şekerli', 'Sütlü']
  },
  {
    category: 'Soğuk İçecekler',
    keywords: ['ice tea', 'limonata', 'churchill', 'kutu içecek', 'kola', 'sprite', 'fanta', 'meyve suyu'],
    modifiers: ['Buzlu', 'Buzsuz', 'Az Buzlu', 'Bardak ile', 'Bardaksız']
  },
  {
    category: 'Kutu Meşrubat Seçimi',
    keywords: ['kutu içecek', 'meşrubat'],
    modifiers: ['Pepsi', 'Coca Cola', 'Sprite', 'Fanta', 'Ice Tea Şeftali', 'Ice Tea Limon']
  },
  {
    category: 'Meyveli Soda Seçimi',
    keywords: ['meyveli soda'],
    modifiers: ['Karpuz-Çilek', 'Elma', 'Limon', 'Mandalina', 'Sade']
  },
  {
    category: 'Frozen Seçimi',
    keywords: ['frozen'],
    modifiers: ['Orman Meyveli', 'Kavunlu', 'Çilekli', 'Karpuzlu', 'Limonlu']
  },
  {
    category: 'Milkshake Seçimi',
    keywords: ['milkshake'],
    modifiers: ['Çikolatalı', 'Vanilyalı', 'Çilekli', 'Muzlu']
  }
];

async function run() {
  console.log('Fetching products...');
  const allProducts = await prisma.product.findMany({
    where: { isActive: true }
  });

  console.log(`Found ${allProducts.length} active products.`);

  for (const def of modifierDefinitions) {
    // Bulunan ürünleri filtrele
    const matchingProducts = allProducts.filter(p => {
      const pName = p.name.toLowerCase();
      return def.keywords.some(kw => pName.includes(kw));
    });

    if (matchingProducts.length === 0) {
      console.log(`No products found for category: ${def.category}`);
      continue;
    }

    console.log(`Found ${matchingProducts.length} products for ${def.category}`);

    // Modifier'ları oluştur veya bul
    for (const modName of def.modifiers) {
      let modifier = await prisma.modifier.findFirst({
        where: { name: modName, isActive: true }
      });

      if (!modifier) {
        modifier = await prisma.modifier.create({
          data: { name: modName, price: 0 }
        });
        console.log(`Created new modifier: ${modName}`);
      }

      // Modifier'ı ürünlere bağla
      for (const product of matchingProducts) {
        // Zaten bağlı mı kontrol et
        const existingConnection = await prisma.product.findFirst({
          where: {
            id: product.id,
            modifiers: {
              some: { id: modifier.id }
            }
          }
        });

        if (!existingConnection) {
          await prisma.product.update({
            where: { id: product.id },
            data: {
              modifiers: {
                connect: { id: modifier.id }
              }
            }
          });
        }
      }
      console.log(`Connected ${modName} to ${matchingProducts.length} products.`);
    }
  }

  console.log('Finished connecting modifiers!');
  await prisma.$disconnect();
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
