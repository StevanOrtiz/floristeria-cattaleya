import { query } from './db';
import { SITE_URL, waLink } from './site';

export interface Category {
  id: string; name: string; short: string; path: string;
  title: string; description: string; intro: string; sort_order: number;
}
export interface ProductImage { id: string; alt: string; src: string; thumb: string }
export interface Product {
  id: string; slug: string; categoryId: string; categoryPath: string; categoryShort: string;
  subcategory: string | null; name: string; description: string; composition: string[];
  dimensions: string | null; care: string[]; watering: string | null; occasions: string[];
  keywords: string[]; price: number | null; published: boolean; featured: boolean;
  sortOrder: number; updatedAt: string; images: ProductImage[];
}

const SELECT = `
  SELECT p.*, c.path AS category_path, c.short AS category_short,
    COALESCE((SELECT json_agg(json_build_object('id', i.id, 'alt', i.alt) ORDER BY i.position, i.created_at)
              FROM product_images i WHERE i.product_id = p.id), '[]'::json) AS images
  FROM products p JOIN categories c ON c.id = p.category_id`;

export function toProduct(r: any): Product {
  return {
    id: r.id, slug: r.slug, categoryId: r.category_id, categoryPath: r.category_path,
    categoryShort: r.category_short, subcategory: r.subcategory, name: r.name,
    description: r.description, composition: r.composition ?? [], dimensions: r.dimensions,
    care: r.care ?? [], watering: r.watering, occasions: r.occasions ?? [], keywords: r.keywords ?? [],
    price: r.price === null ? null : Number(r.price), published: r.published, featured: r.featured,
    sortOrder: r.sort_order, updatedAt: new Date(r.updated_at).toISOString(),
    images: (r.images ?? []).map((i: any) => ({
      id: i.id, alt: i.alt || r.name, src: `/media/${i.id}`, thumb: `/media/${i.id}?s=thumb`,
    })),
  };
}

export interface ProductFilter { category?: string; featured?: boolean; all?: boolean; limit?: number }

export async function getProducts(f: ProductFilter = {}): Promise<Product[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (!f.all) where.push('p.published');
  if (f.category) { params.push(f.category); where.push(`p.category_id = $${params.length}`); }
  if (f.featured) where.push('p.featured');
  let sqlText = SELECT + (where.length ? ` WHERE ${where.join(' AND ')}` : '');
  sqlText += ' ORDER BY c.sort_order, p.sort_order, p.name';
  if (f.limit) { params.push(Math.max(1, Math.floor(f.limit))); sqlText += ` LIMIT $${params.length}`; }
  return (await query(sqlText, params)).map(toProduct);
}

export async function getProductBySlug(categoryId: string, slug: string): Promise<Product | null> {
  const rows = await query(`${SELECT} WHERE p.published AND p.category_id = $1 AND p.slug = $2`, [categoryId, slug]);
  return rows[0] ? toProduct(rows[0]) : null;
}

export async function getProductById(id: string): Promise<Product | null> {
  const rows = await query(`${SELECT} WHERE p.id = $1`, [id]);
  return rows[0] ? toProduct(rows[0]) : null;
}

export const getCategories = () => query<Category>('SELECT * FROM categories ORDER BY sort_order');
export async function getCategoryByPath(path: string) {
  return (await query<Category>('SELECT * FROM categories WHERE path = $1', [path]))[0] ?? null;
}
export async function getCategoryById(id: string) {
  return (await query<Category>('SELECT * FROM categories WHERE id = $1', [id]))[0] ?? null;
}

/** Cover photo of the first image that exists. */
export const cover = (p: Product) => p.images[0] ?? null;
export const productUrl = (p: Product) => `${p.categoryPath}/${p.slug}`;
export const formatPrice = (n: number | null) =>
  n === null ? 'Consultar precio' : new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);

export function productWaLink(p: Product, message = 'Hola, me gustaría pedir este producto:'): string {
  return waLink(`${message} ${p.name}`, SITE_URL + productUrl(p));
}

/** Public pages: 1 min CDN cache, so admin edits show up quickly. */
export const cachePublic = 'public, max-age=0, s-maxage=60, stale-while-revalidate=600';
