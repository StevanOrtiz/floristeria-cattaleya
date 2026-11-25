import { defineConfig, envField } from 'astro/config';
import netlify from '@astrojs/netlify';

export default defineConfig({
  site: 'https://floristeriacattaleya.es',
  output: 'server',
  adapter: netlify({ devFeatures: { environmentVariables: false, images: false, edgeFunctions: false } }),
  trailingSlash: 'never',
  build: { inlineStylesheets: 'always' },
  security: { checkOrigin: false },
  vite: { build: { assetsInlineLimit: 0 } },
  env: {
    schema: {
      DATABASE_URL: envField.string({ context: 'server', access: 'secret', optional: true }),
      TURNSTILE_SECRET_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      PUBLIC_TURNSTILE_SITE_KEY: envField.string({ context: 'client', access: 'public', optional: true }),
      PUBLIC_GSC_VERIFICATION: envField.string({ context: 'client', access: 'public', optional: true }),
    },
  },
});
