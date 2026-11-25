import { neon } from '@neondatabase/serverless';
import { DATABASE_URL } from 'astro:env/server';

type Sql = ReturnType<typeof neon>;
let client: Sql | undefined;

function getClient(): Sql {
  if (!client) {
    if (!DATABASE_URL) throw new Error('DATABASE_URL is not set');
    client = neon(DATABASE_URL);
  }
  return client;
}

/** Parameterised query. Always pass user input through `params`, never concatenate. */
export async function query<T = Record<string, any>>(text: string, params: unknown[] = []): Promise<T[]> {
  const rows = await getClient().query(text, params as any[]);
  return rows as unknown as T[];
}

export async function dbHealthy(): Promise<boolean> {
  try {
    await query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}
