# Paint Store MVP — Astro + Prisma (Paso 1)

**Objetivo del Paso 1**: repo base con catálogo en **USD** (sin VES todavía),
datos seed (10 SKUs) y **AEO** listo (metadatos + JSON-LD).

## Stack
- Astro 5 (SSR listo, adapter node).
- TypeScript + Inter.
- Prisma ORM (Postgres).
- AEO/SEO base (metadatos, OG/Twitter, JSON-LD).
- Placeholders de colores y logo.

## Scripts
```bash
npm i
npx prisma migrate dev --name init
npm run seed
npm run dev
```

## Variables (.env)
Copia `.env.example` a `.env` y completa:
- `DATABASE_URL` = url Postgres (Neon/Local)
- `SITE_URL` = https://tudominio.com (canónicas)

## Qué verás en este Paso 1
- Home con **catálogo en USD** (precio = costo_base_usd × (1+margen)).
- Head AEO y JSON-LD (Organization).
- Estructura lista para el Paso 2: `/api/fx/tasa-ves` + VES.

© 2025 — Placeholder brand.