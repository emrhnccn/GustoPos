const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function reset() {
  console.log("Menü, siparişler ve kategoriler tamamen sıfırlanıyor...");
  try {
    await prisma.auditLog.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.stockTransaction.deleteMany();
    await prisma.recipeItem.deleteMany();
    await prisma.modifier.deleteMany();
    await prisma.printerProductAssignment.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
    console.log("Veritabanı tertemiz oldu.");
  } catch (err) {
    console.error("Sıfırlama sırasında hata:", err);
  }
}

reset().catch(console.error).finally(() => prisma.$disconnect());
