import type { APIRoute } from 'astro';
import { getCategories, getProducts, productUrl } from '../lib/catalog';
import { SITE_URL } from '../lib/site';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

export const GET: APIRoute = async () => {
  const [cats, products] = await Promise.all([getCategories(), getProducts({})]);
  const urls: { loc: string; lastmod?: string }[] = [
    ...['/', '/catalogo', '/galeria', '/contacto', '/cuidado-de-plantas'].map((p) => ({ loc: SITE_URL + (p === '/' ? '' : p) })),
    ...cats.map((c) => ({ loc: SITE_URL + c.path })),
    ...products.map((p) => ({ loc: SITE_URL + productUrl(p), lastmod: p.updatedAt })),
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`)
    .join('\n')}\n</urlset>`;
  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=0, s-maxage=300' },
  });
};
