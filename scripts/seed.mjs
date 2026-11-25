// Seeds categories + products with generated placeholder photos.
// WARNING: overwrites products with the same slug. Use on a fresh DB only.
import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { getSql, applySchema } from './_db.mjs';

const sql = getSql();
await applySchema(sql);
const data = JSON.parse(readFileSync(new URL('../db/seed/catalog.json', import.meta.url), 'utf8'));

for (const c of data.categories) {
  await sql.query(
    `INSERT INTO categories (id,name,short,path,title,description,intro,sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (id) DO UPDATE SET name=$2,short=$3,path=$4,title=$5,description=$6,intro=$7,sort_order=$8`,
    [c.id, c.name, c.short, c.path, c.title, c.description, c.intro, c.sort_order],
  );
}

function placeholder(tone, label, size) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
    <defs><radialGradient id="g" cx="35%" cy="30%" r="90%"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="${tone}"/></radialGradient></defs>
    <rect width="100" height="100" fill="url(#g)"/>
    <g fill="#fff" fill-opacity=".35"><circle cx="50" cy="42" r="14"/><circle cx="36" cy="54" r="11"/><circle cx="64" cy="54" r="11"/><circle cx="50" cy="62" r="12"/></g>
    </svg>`;
  return sharp(Buffer.from(svg)).webp({ quality: 80 }).toBuffer();
}

let order = {};
for (const p of data.products) {
  order[p.category] = (order[p.category] ?? 0) + 1;
  const rows = await sql.query(
    `INSERT INTO products (slug,category_id,name,description,composition,care,watering,occasions,keywords,price,featured,sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (slug) DO UPDATE SET category_id=$2,name=$3,description=$4,composition=$5,care=$6,watering=$7,
       occasions=$8,keywords=$9,price=$10,featured=$11,sort_order=$12,updated_at=now()
     RETURNING id`,
    [p.slug, p.category, p.name, p.description, p.composition ?? [], p.care ?? [], p.watering ?? null,
     p.occasions ?? [], p.keywords ?? [], p.price, !!p.featured, order[p.category]],
  );
  const id = rows[0].id;
  await sql.query('DELETE FROM product_images WHERE product_id=$1', [id]);
  const full = await placeholder(p.tone, p.name, 1000);
  const thumb = await placeholder(p.tone, p.name, 480);
  await sql.query(
    `INSERT INTO product_images (product_id, position, alt, data_full, data_thumb) VALUES ($1,0,$2,$3,$4)`,
    [id, p.name, full, thumb],
  );
  console.log('ok', p.slug);
}
console.log('Seed done. Replace placeholder photos from /admin.');
