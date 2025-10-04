/** @type {import('astro').AstroUserConfig} */
import node from '@astrojs/node';
export default {
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  server: { host: true },
};