// src\pages\api\fx\tasa-ves.ts
import type { APIRoute } from 'astro';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// --- util: mediana ---
function median(arr: number[]) {
  if (!arr.length) return null;
  const a = [...arr].sort((x, y) => x - y);
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

async function fetchBinanceMedianVES() {
  const url = 'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search';
  const body = {
    page: 1,
    rows: 20,
    publisherType: null,
    asset: "USDT",
    tradeType: "BUY",  // comprar USDT pagando en VES
    fiat: "VES",
    transAmount: "50"
  };

  // ⚠️ Algunos entornos bloquean si no hay headers de navegador
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'accept': 'application/json, text/plain, */*',
      'content-type': 'application/json',
      'cache-control': 'no-cache',
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'clienttype': 'web',
      'lang': 'es'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    throw new Error(`Binance P2P status ${res.status}`);
  }

  const data = await res.json();
  const prices: number[] = (data?.data || [])
    .map((x: any) => Number(x?.adv?.price))
    .filter((n: number) => Number.isFinite(n));

  const m = median(prices);
  if (!m) throw new Error('Sin precios VES');
  return m;
}

export const GET: APIRoute = async ({ url }) => {
  try {
    // 1) Soporte de prueba manual: ?mock=valor  (ej: /api/fx/tasa-ves?mock=40)
    const mock = url.searchParams.get('mock');
    const raw = mock ? Number(mock) : await fetchBinanceMedianVES();

    // 2) EMA a partir del último valor guardado
    const last = await prisma.rate.findFirst({ orderBy: { createdAt: 'desc' } });
    const prevEma = last ? Number(last.ema) : null;
    const ema = prevEma == null ? raw : 0.3 * raw + 0.7 * prevEma;

    // 3) Persistir
    const saved = await prisma.rate.create({
      data: { raw, ema, source: mock ? 'Mock manual' : 'Binance P2P' }
    });

    return new Response(JSON.stringify({
      tasa: Number(saved.raw),
      ema: Number(saved.ema),
      fuente: saved.source,
      ts: saved.createdAt
    }), { status: 200, headers: { 'content-type': 'application/json' } });

  } catch (e: any) {
    // Fallback: si ya tenemos algo guardado, devolvemos cache
    const last = await prisma.rate.findFirst({ orderBy: { createdAt: 'desc' } });
    if (last) {
      return new Response(JSON.stringify({
        tasa: Number(last.raw),
        ema: Number(last.ema),
        fuente: last.source + ' (cache)',
        ts: last.createdAt,
        warning: e?.message || 'FX error'
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    // Último recurso: valor fijo para mostrar UI (quítalo en prod)
    const fallback = 40; // VES por USDT de ejemplo
    return new Response(JSON.stringify({
      tasa: fallback,
      ema: fallback,
      fuente: 'Fallback local',
      ts: new Date().toISOString(),
      warning: e?.message || 'FX error (sin cache)'
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
};
