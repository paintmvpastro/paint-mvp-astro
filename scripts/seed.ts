import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const products = [
  { sku: 'PNT-001-1L', name: 'Pintura Acrílica Blanca', sizeMl: 1000, costBaseUsd: 5.20, margin: 0.40 },
  { sku: 'PNT-001-4L', name: 'Pintura Acrílica Blanca', sizeMl: 4000, costBaseUsd: 18.50, margin: 0.38 },
  { sku: 'PNT-001-19L', name: 'Pintura Acrílica Blanca', sizeMl: 19000, costBaseUsd: 78.00, margin: 0.35 },
  { sku: 'PNT-002-1L', name: 'Pintura Acrílica Negra', sizeMl: 1000, costBaseUsd: 5.40, margin: 0.40 },
  { sku: 'PNT-002-4L', name: 'Pintura Acrílica Negra', sizeMl: 4000, costBaseUsd: 19.00, margin: 0.38 },
  { sku: 'PNT-003-1L', name: 'Esmalte Sintético Rojo', sizeMl: 1000, costBaseUsd: 8.40, margin: 0.45 },
  { sku: 'PNT-003-4L', name: 'Esmalte Sintético Rojo', sizeMl: 4000, costBaseUsd: 29.70, margin: 0.43 },
  { sku: 'PNT-004-1L', name: 'Sellador Vinílico', sizeMl: 1000, costBaseUsd: 4.10, margin: 0.42 },
  { sku: 'PNT-005-4L', name: 'Fondo Anticorrosivo Gris', sizeMl: 4000, costBaseUsd: 21.90, margin: 0.41 },
  { sku: 'PNT-006-19L', name: 'Pintura Exterior Premium', sizeMl: 19000, costBaseUsd: 115.30, margin: 0.36 },
];
async function main() {
  for (const p of products) {
    await prisma.product.upsert({
      where: { sku: p.sku },
      update: p,
      create: p
    });
  }
  console.log('Seed listo');
}
main().finally(() => prisma.$disconnect());