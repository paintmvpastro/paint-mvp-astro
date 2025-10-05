/** @type {import('astro').AstroUserConfig} */
import vercel from '@astrojs/vercel/serverless';
export default {
  output: 'server',
  adapter: vercel(),
  server: { host: true },
};
