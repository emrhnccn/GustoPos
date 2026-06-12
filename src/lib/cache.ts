/**
 * Cache Katmanı — Next.js unstable_cache + revalidateTag kullanır.
 *
 * Vercel Serverless ortamında Neon'un "auto-suspend" özelliği cold start'a neden olur.
 * Bu modül sık okunan verileri Next.js'in server-side cache'inde tutar;
 * böylece her istekte veritabanına gitmek gerekmez.
 *
 * NOT: Bu Next.js versiyonunda revalidateTag iki argüman alır:
 *      revalidateTag(tag, 'max') — stale-while-revalidate semantics
 */

import { unstable_cache, revalidateTag } from 'next/cache';
import { db } from '@/lib/db';

// ─── TTL Sabitleri (saniye) ───────────────────────────────────────────────────
const TTL = {
  CATEGORIES: 60,
  MODIFIERS: 120,
  SUPPLIERS: 60,
  INGREDIENTS: 60,
} as const;

// ─── Cache Tag'leri ───────────────────────────────────────────────────────────
export const CACHE_TAGS = {
  CATEGORIES: 'categories',
  PRODUCTS: 'products',
  MODIFIERS: 'modifiers',
  TABLES: 'tables',
  CUSTOMERS: 'customers',
  SUPPLIERS: 'suppliers',
  INGREDIENTS: 'ingredients',
  MENU: 'menu',
} as const;

// ─── Invalidation Helpers ─────────────────────────────────────────────────────
// 'max' = stale-while-revalidate; bu Next.js 16'da önerilen 2. argümandır
export function invalidateCategories() {
  revalidateTag(CACHE_TAGS.CATEGORIES, 'max');
  revalidateTag(CACHE_TAGS.MENU, 'max');
}

export function invalidateProducts() {
  revalidateTag(CACHE_TAGS.PRODUCTS, 'max');
  revalidateTag(CACHE_TAGS.MENU, 'max');
}

export function invalidateModifiers() {
  revalidateTag(CACHE_TAGS.MODIFIERS, 'max');
  revalidateTag(CACHE_TAGS.MENU, 'max');
}

export function invalidateTables() {
  revalidateTag(CACHE_TAGS.TABLES, 'max');
}

export function invalidateCustomers() {
  revalidateTag(CACHE_TAGS.CUSTOMERS, 'max');
}

export function invalidateSuppliers() {
  revalidateTag(CACHE_TAGS.SUPPLIERS, 'max');
}

export function invalidateIngredients() {
  revalidateTag(CACHE_TAGS.INGREDIENTS, 'max');
}

// ─── Cached DB Sorguları ──────────────────────────────────────────────────────

/**
 * Tüm kategori + ürün + modifier ağacını cache'le.
 * POS menüsünde ve admin panelinde kullanılır.
 */
export const getCachedMenu = unstable_cache(
  async () => {
    return db.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        products: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          include: {
            modifiers: { where: { isActive: true } },
          },
        },
      },
    });
  },
  [CACHE_TAGS.MENU],
  {
    tags: [CACHE_TAGS.MENU, CACHE_TAGS.CATEGORIES, CACHE_TAGS.PRODUCTS, CACHE_TAGS.MODIFIERS],
    revalidate: TTL.CATEGORIES,
  }
);

/**
 * Modifier listesi (sadece aktif olanlar, ürün ilişkisi olmadan — basit listeler için).
 */
export const getCachedModifiers = unstable_cache(
  async () => {
    return db.modifier.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  },
  [CACHE_TAGS.MODIFIERS],
  {
    tags: [CACHE_TAGS.MODIFIERS],
    revalidate: TTL.MODIFIERS,
  }
);

/**
 * Tedarikçi listesi.
 */
export const getCachedSuppliers = unstable_cache(
  async () => {
    return db.supplier.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  },
  [CACHE_TAGS.SUPPLIERS],
  {
    tags: [CACHE_TAGS.SUPPLIERS],
    revalidate: TTL.SUPPLIERS,
  }
);

/**
 * Malzeme (ingredient) listesi.
 */
export const getCachedIngredients = unstable_cache(
  async () => {
    return db.ingredient.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  },
  [CACHE_TAGS.INGREDIENTS],
  {
    tags: [CACHE_TAGS.INGREDIENTS],
    revalidate: TTL.INGREDIENTS,
  }
);
