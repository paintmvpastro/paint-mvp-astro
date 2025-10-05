// src/pages/api/fx/tasa-ves.ts
import type { APIRoute } from 'astro';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Normaliza precios en formato latino:
 * "292.600"   -> 292600
 * "292,600.5" -> 292600.5
 * "Bs 292.600"-> 292600
 */
function parseVESPrice(input: any): number {
  const s = String(input)
    .replace(/\./g, '')   // quita separador de miles latino
    .replace(',', '.');   // pasa coma decimal a punto
  const n = Number(s.replace(/[^\d.]/g, ''));
  if (!Number.isFinite(n)) throw new Error(`Precio inválido: ${input}`);
  return n;
}

/** Lee P2P Binance (USDT/BUY en VES) y devuelve la mediana */
async function fetchBinanceMedianVES(): Promise<number> {
  const url = 'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search';
  const body = {
    page: 1,
    rows: 20,
    publisherType: null,
    asset: 'USDT',
    tradeType: 'BUY',  // comprar USDT pagando en VES
    fiat: 'VES',
    transAmount: '50'
  };

  // Algunos entornos bloquean si no simulamos navegador
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      accept: 'application/json, text/plain, */*',
      'content-type': 'application/json',
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      clienttype: 'web',
      lang: 'es'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) throw new Error(`Binance P2P status ${res.status}`);
  const data = await res.json();

  const prices: number[] = (data?.data || [])
    .map((x: any) => parseVESPrice(x?.adv?.price))
    .filter((n: number) => Number.isFinite(n) && n > 0);

  if (!prices.length) throw new Error('Sin precios VES');

  prices.sort((a, b) => a - b);
  const mid = Math.floor(prices.length / 2);
  return prices.length % 2 ? prices[mid] : (prices[mid - 1] + prices[mid]) / 2;
}

/** GET /api/fx/tasa-ves
 *  - ?mock=123    -> fuerza valor (debug)
 *  - DEV_FORCE_RATE en .env (solo dev) -> fuerza valor
 *  - Guarda raw + ema en tabla Rate
 */
export const GET: APIRoute = async ({ url }) => {
  try {
    // 1) Prioriza mock de query o DEV_FORCE_RATE
    const qMock = url.searchParams.get('mock');
    const envMock = process.env.DEV_FORCE_RATE;
    const raw = qMock
      ? Number(qMock)
      : envMock
      ? Number(envMock)
      : await fetchBinanceMedianVES();

    // 2) EMA más reactiva (60% último, 40% previo)
    const last = await prisma.rate.findFirst({ orderBy: { createdAt: 'desc' } });
    const prevEma = last ? Number(last.ema) : null;
    const ema = prevEma == null ? raw : 0.6 * raw + 0.4 * prevEma;

    // 3) Persistir lectura
    const saved = await prisma.rate.create({
      data: { raw, ema, source: qMock ? 'Mock manual' : envMock ? 'DEV_FORCE_RATE' : 'Binance P2P' }
    });

    return new Response(
      JSON.stringify({
        tasa: Number(saved.raw),
        ema: Number(saved.ema),
        fuente: saved.source,
        ts: saved.createdAt
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  } catch (e: any) {
    // Fallback con último valor guardado (si existe)
    const last = await prisma.rate.findFirst({ orderBy: { createdAt: 'desc' } });
    if (last) {
      return new Response(
        JSON.stringify({
          tasa: Number(last.raw),
          ema: Number(last.ema),
          fuente: (last.source || 'cache') + ' (cache)',
          ts: last.createdAt,
          warning: e?.message || 'FX error'
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }
    // Sin cache previa -> error explícito
    return new Response(
      JSON.stringify({ error: e?.message || 'FX error (sin cache)' }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
};
