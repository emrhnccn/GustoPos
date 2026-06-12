import fs from 'fs';
import * as cheerio from 'cheerio';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  const html = fs.readFileSync('C:\\Users\\Cucen_Home\\.gemini\\antigravity-ide\\brain\\357499c7-4889-4ad0-af41-81ef819e3752\\.system_generated\\steps\\475\\content.md', 'utf8');
  const $ = cheerio.load(html);

  // Parse Categories
  const categoriesMap = new Map();
  $('.nav-pills .nav-link').each((i, el) => {
    const id = $(el).attr('data-bs-target').replace('#', '');
    const name = $(el).text().trim();
    categoriesMap.set(id, { name, sortOrder: i + 1, products: [] });
  });

  // Parse Products
  $('.tab-pane').each((i, el) => {
    const paneId = $(el).attr('id');
    const cat = categoriesMap.get(paneId);
    if (!cat) return;

    $(el).find('.cat-pricing-list').each((j, productEl) => {
      // Name
      let rawName = $(productEl).find('.cat-pricing-title h4').text().trim();
      // Remove any extra text from imgs (sometimes text gets concatenated if not careful)
      $(productEl).find('.cat-pricing-title h4 img').remove();
      $(productEl).find('.cat-pricing-title h4 div').remove();
      const name = $(productEl).find('.cat-pricing-title h4').text().trim().replace(/\n/g, '').replace(/\s+/g, ' ');

      // Price
      const priceText = $(productEl).find('.cat-price').text().trim();
      const priceMatch = priceText.match(/([\d.,]+)/);
      let price = 0;
      if (priceMatch) {
        price = parseFloat(priceMatch[1].replace(/\./g, '').replace(',', '.')); // Handle formats like 1.250₺ or 15,50₺
      }

      // Desc
      const desc = $(productEl).find('p').text().trim();

      // Image
      let imageSrc = $(productEl).find('.cat-pri-icon img').attr('src');
      if (imageSrc) {
        imageSrc = `https://m.1menu.com.tr/salaascafe/${imageSrc}`;
      }

      cat.products.push({
        name,
        price,
        description: desc,
        image: imageSrc,
        sortOrder: j + 1,
        isStockControlled: false,
        stockLevel: 0
      });
    });
  });

  console.log(`Found ${categoriesMap.size} categories.`);

  // Delete all existing menu
  console.log('Deleting existing menu...');
  await prisma.product.deleteMany({});
  await prisma.category.deleteMany({});
  
  // Insert new menu
  for (const cat of categoriesMap.values()) {
    console.log(`Inserting category: ${cat.name} with ${cat.products.length} products`);
    const createdCat = await prisma.category.create({
      data: {
        name: cat.name,
        sortOrder: cat.sortOrder,
      }
    });

    for (const prod of cat.products) {
      await prisma.product.create({
        data: {
          name: prod.name,
          price: prod.price,
          image: prod.image,
          categoryId: createdCat.id,
          isStockControlled: false,
          stockLevel: 0,
          sortOrder: prod.sortOrder
        }
      });
    }
  }

  console.log('Done!');
  await prisma.$disconnect();
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
