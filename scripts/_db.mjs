import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';
import { randomBytes, scrypt } from 'node:crypto';

export function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('Missing DATABASE_URL (set it in .env).');
    process.exit(1);
  }
  return neon(url);
}

export async function applySchema(sql) {
  const raw = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');
  const statements = raw.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean);
  for (const st of statements) await sql.query(st);
}

const N = 32768, R = 8, P = 1;
export function hashPassword(password) {
  const salt = randomBytes(16);
  return new Promise((resolve, reject) => {
    scrypt(password.normalize('NFKC'), salt, 64, { N, r: R, p: P, maxmem: 128 * N * R * 2 }, (err, key) => {
      if (err) return reject(err);
      resolve(`scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${key.toString('base64')}`);
    });
  });
}
