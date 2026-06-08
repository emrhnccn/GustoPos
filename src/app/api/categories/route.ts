import { NextResponse } from 'next/server';
import { getCachedMenu } from '@/lib/cache';

export async function GET() {
  try {
    const categories = await getCachedMenu();
    return NextResponse.json(categories);
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Kategoriler API Hatası:', err);
    return NextResponse.json(
      { error: 'Kategoriler yüklenirken hata oluştu.' },
      { status: 500 }
    );
  }
}
