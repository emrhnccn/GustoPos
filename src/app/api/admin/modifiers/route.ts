import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const modifiers = await db.modifier.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: {
        products: {
          select: { id: true, name: true }
        }
      }
    });
    return NextResponse.json(modifiers);
  } catch (error: any) {
    console.error('Modifiers GET API Hatası:', error);
    return NextResponse.json({ error: 'Ek seçenekler yüklenemedi.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, id, name, price, productIds } = body;

    if (action === 'create') {
      if (!name || price === undefined) {
        return NextResponse.json({ error: 'Ad ve fiyat zorunludur.' }, { status: 400 });
      }
      const newModifier = await db.modifier.create({
        data: { 
          name, 
          price: parseFloat(price),
          products: {
            connect: productIds ? productIds.map((pid: string) => ({ id: pid })) : []
          }
        },
        include: {
          products: {
            select: { id: true, name: true }
          }
        }
      });
      return NextResponse.json(newModifier);
    }

    if (action === 'update') {
      if (!id || !name || price === undefined) {
        return NextResponse.json({ error: 'ID, ad ve fiyat zorunludur.' }, { status: 400 });
      }
      const updated = await db.modifier.update({
        where: { id },
        data: { 
          name, 
          price: parseFloat(price),
          products: {
            set: productIds ? productIds.map((pid: string) => ({ id: pid })) : []
          }
        },
        include: {
          products: {
            select: { id: true, name: true }
          }
        }
      });
      return NextResponse.json(updated);
    }

    if (action === 'delete') {
      if (!id) return NextResponse.json({ error: 'ID gereklidir.' }, { status: 400 });
      // Soft delete
      const deleted = await db.modifier.update({
        where: { id },
        data: { isActive: false },
      });
      return NextResponse.json(deleted);
    }

    return NextResponse.json({ error: 'Geçersiz işlem.' }, { status: 400 });
  } catch (error: any) {
    console.error('Modifiers POST API Hatası:', error);
    return NextResponse.json({ error: error.message || 'Ek seçenek işlemi başarısız.' }, { status: 500 });
  }
}
