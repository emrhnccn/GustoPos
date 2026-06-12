const cheerio = require('cheerio');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    console.log("Fetching HTML from 1menu.com.tr...");
    const res = await fetch("https://m.1menu.com.tr/salaascafe/");
    const html = await res.text();
    const $ = cheerio.load(html);

    console.log("Parsing categories...");
    const categories = [];

    $('.nav-link').each((i, el) => {
        const catName = $(el).text().trim();
        const targetId = $(el).attr('data-bs-target'); // e.g. #pills-tabKahvaltı
        
        categories.push({ name: catName, targetId });
    });

    for (let i = 0; i < categories.length; i++) {
        const cat = categories[i];
        console.log(`Processing category: ${cat.name}`);
        
        // Ensure category exists
        let dbCat = await prisma.category.findFirst({ where: { name: cat.name } });
        if (!dbCat) {
            dbCat = await prisma.category.create({
                data: {
                    name: cat.name,
                    sortOrder: i,
                    isActive: true
                }
            });
        }

        // Try to find the tab pane for this category
        const tabPane = $(cat.targetId);
        const productItems = tabPane.find('.cat-pricing-list');

        for (let j = 0; j < productItems.length; j++) {
            const pEl = $(productItems[j]);
            const titleEl = pEl.find('.cat-pricing-title h4').clone();
            titleEl.children().remove(); // remove img tags like "yeni" or "populer"
            let name = titleEl.text().replace(/\n/g, '').trim();
            
            // Clean up name by removing extra whitespaces and new lines
            name = name.replace(/\s+/g, ' ');

            const priceText = pEl.find('.cat-price').text().replace(/[^0-9,.]/g, '').replace(',', '.');
            let price = parseFloat(priceText) || 0;

            const desc = pEl.find('p').text().trim();
            const imgPath = pEl.find('.cat-pri-icon img').attr('src');
            let imageUrl = null;
            if (imgPath) {
                imageUrl = "https://m.1menu.com.tr/salaascafe/" + imgPath;
            }

            if (name) {
                // Check if product exists to avoid duplicate imports
                let existingProduct = await prisma.product.findFirst({ where: { name: name } });
                if (!existingProduct) {
                    await prisma.product.create({
                        data: {
                            name: name,
                            price: price,
                            categoryId: dbCat.id,
                            isActive: true,
                            image: imageUrl,
                            stockLevel: 0,
                            isStockControlled: false
                        }
                    });
                    console.log(`  + Added: ${name} - ${price} TL`);
                } else {
                    console.log(`  = Skipped existing: ${name}`);
                }
            }
        }
    }
    console.log("\n✅ Import completely finished. You can now see them in your Admin Panel.");
}

run().catch(console.error).finally(() => prisma.$disconnect());
