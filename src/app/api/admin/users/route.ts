import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const users = await db.user.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(users);
  } catch (error) {
    console.error('Users GET error:', error);
    return NextResponse.json({ error: 'Personeller alınamadı.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { id, name, pinHash, role, isActive } = await request.json();

    if (!name || !pinHash || !role) {
      return NextResponse.json({ error: 'Eksik bilgi girdiniz.' }, { status: 400 });
    }

    if (id) {
      // Update existing
      const updated = await db.user.update({
        where: { id },
        data: { name, pinHash, role, isActive }
      });
      return NextResponse.json(updated);
    } else {
      // Create new
      const newUser = await db.user.create({
        data: { name, pinHash, role, isActive }
      });
      return NextResponse.json(newUser);
    }
  } catch (error) {
    console.error('Users POST error:', error);
    return NextResponse.json({ error: 'Personel kaydedilemedi.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID gerekli.' }, { status: 400 });
    }

    await db.user.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Users DELETE error:', error);
    return NextResponse.json({ error: 'Personel silinemedi.' }, { status: 500 });
  }
}
