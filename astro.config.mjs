// astro.config.mjs
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import vercel from '@astrojs/vercel'; // ← actualizado (antes: @astrojs/vercel/serverless)

export default defineConfig({
  output: 'server',
  adapter: vercel(),
  server: { host: true },
  integrations: [preact()],
  alias: {
    '@': './src',
  },
});
