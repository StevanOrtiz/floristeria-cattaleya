import type { APIRoute } from 'astro';
import { searchProducts } from '../../lib/search';
import { cover, formatPrice, productUrl } from '../../lib/catalog';

export const GET: APIRoute = async ({ url }) => {
  const q = (url.searchParams.get('q') ?? '').slice(0, 80);
  const products = q.trim().length >= 2 ? await searchProducts(q, { limit: 6 }) : [];
  const results = products.map((p) => ({
    name: p.name,
    url: productUrl(p),
    category: p.categoryShort,
    price: formatPrice(p.price),
    image: cover(p)?.thumb ?? null,
  }));
  return new Response(JSON.stringify({ results }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' },
  });
};
