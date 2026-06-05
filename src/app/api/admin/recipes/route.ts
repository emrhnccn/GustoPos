import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET: Tüm aktif ürünlerin reçetelerini listele
export async function GET(request: Request) {
  try {
    const productsWithRecipes = await db.product.findMany({
      where: { isActive: true },
      include: {
        recipeItems: {
          include: {
            ingredient: true
          }
        },
        category: { select: { name: true } }
      },
      orderBy: { name: 'asc' }
    });
    return NextResponse.json(productsWithRecipes);
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Recipes GET error:', err);
    return NextResponse.json({ error: 'Reçeteler yüklenirken hata oluştu.' }, { status: 500 });
  }
}

// POST: Ürünün reçetesini güncelle / kaydet
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { productId, items } = body; // items: Array<{ ingredientId, quantityRequired, wastePercentage }>

    if (!productId || !Array.isArray(items)) {
      return NextResponse.json({ error: 'Eksik veya geçersiz parametre (productId ve items zorunludur)' }, { status: 400 });
    }

    const updatedProduct = await db.$transaction(async (tx) => {
      // 1. Mevcut reçete kalemlerini temizle
      await tx.recipeItem.deleteMany({
        where: { productId }
      });

      // 2. Yeni reçete kalemlerini oluştur
      if (items.length > 0) {
        await tx.recipeItem.createMany({
          data: items.map((item: any) => ({
            productId,
            ingredientId: item.ingredientId,
            quantityRequired: parseFloat(item.quantityRequired),
            wastePercentage: parseFloat(item.wastePercentage || 0)
          }))
        });
      }

      // 3. Güncel ürünü reçetesiyle çek
      return await tx.product.findUnique({
        where: { id: productId },
        include: {
          recipeItems: {
            include: {
              ingredient: true
            }
          }
        }
      });
    });

    return NextResponse.json({ success: true, product: updatedProduct });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Recipes POST error:', err);
    return NextResponse.json({ error: err.message || 'Reçete kaydedilirken hata oluştu.' }, { status: 500 });
  }
}
