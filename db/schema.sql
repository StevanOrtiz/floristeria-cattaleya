CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION f_unaccent(text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS $$ SELECT public.unaccent('public.unaccent', $1) $$;

CREATE TABLE IF NOT EXISTS categories (
  id text PRIMARY KEY CHECK (id ~ '^[a-z]+$'),
  name text NOT NULL,
  short text NOT NULL,
  path text NOT NULL UNIQUE CHECK (path ~ '^/[a-z0-9-]+$'),
  title text NOT NULL,
  description text NOT NULL,
  intro text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) <= 80),
  category_id text NOT NULL REFERENCES categories(id),
  subcategory text CHECK (length(subcategory) <= 40),
  name text NOT NULL CHECK (length(name) BETWEEN 2 AND 120),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 2000),
  composition text[] NOT NULL DEFAULT '{}',
  dimensions text CHECK (length(dimensions) <= 120),
  care text[] NOT NULL DEFAULT '{}',
  watering text CHECK (length(watering) <= 120),
  occasions text[] NOT NULL DEFAULT '{}',
  keywords text[] NOT NULL DEFAULT '{}',
  price numeric(8,2),
  published boolean NOT NULL DEFAULT true,
  featured boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS products_cat_idx ON products(category_id, sort_order);

CREATE TABLE IF NOT EXISTS product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  alt text NOT NULL DEFAULT '' CHECK (length(alt) <= 200),
  mime text NOT NULL DEFAULT 'image/webp',
  data_full bytea NOT NULL,
  data_thumb bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_images_product_idx ON product_images(product_id, position);

CREATE TABLE IF NOT EXISTS admin_users (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  email text NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash text PRIMARY KEY,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  ip text,
  user_agent text
);

CREATE TABLE IF NOT EXISTS rate_limits (
  key text PRIMARY KEY,
  window_start timestamptz NOT NULL DEFAULT now(),
  count int NOT NULL DEFAULT 0,
  locked_until timestamptz
);

CREATE TABLE IF NOT EXISTS contact_messages (
  id bigserial PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('contacto','evento')),
  nombre text NOT NULL,
  email text NOT NULL,
  telefono text,
  asunto text,
  tipo_evento text,
  fecha_evento text,
  lugar text,
  mensaje text NOT NULL CHECK (length(mensaje) BETWEEN 10 AND 3000),
  consentimiento boolean NOT NULL CHECK (consentimiento),
  consentimiento_at timestamptz NOT NULL DEFAULT now(),
  atendido boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
