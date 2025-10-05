import type { APIRoute } from "astro";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

/* ---------- Utilidades ---------- */

// Formato venezolano a 2 decimales
const fmtVE2 = (n: number) =>
  n.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Parse robusto de precios VES como los de Binance.
 * Acepta: 293.79, 293,79, 293.200, 293,200.50, "Bs 293.79", "293 804,689", etc.
 * Regla clave: cuando hay 2–3 dígitos tras el punto/coma y no hay el otro separador,
 * lo tomamos como DECIMAL, no como miles (e.g. 293.200 = 293,20).
 */
function parseVESPrice(input: unknown): number {
  let s = String(input ?? "").trim();

  // Quitar símbolos/espacios
  s = s.replace(/[^\d.,\s]/g, "").replace(/\s+/g, "");

  const hasDot = s.includes(".");
  const hasComma = s.includes(",");

  // Patrones que indican decimal con 2–3 dígitos
  const looksDotDecimal = /^\d{1,3}\.\d{2,3}$/.test(s);    // 293.20 / 293.200
  const looksComDecimal = /^\d{1,3},\d{2,3}$/.test(s);     // 293,20 / 293,200

  // Patrones de miles
  const dotThousands   = /^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s);
  const commaThousands = /^\d{1,3}(,\d{3})(\.\d+)?$/.test(s);

  if (hasDot && hasComma) {
    // El separador más a la derecha manda como decimal
    const lastDot = s.lastIndexOf(".");
    const lastComma = s.lastIndexOf(",");
    if (lastComma > lastDot) {
      // ',' decimal
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      // '.' decimal
      s = s.replace(/,/g, "");
    }
  } else if (looksComDecimal) {
    s = s.replace(",", ".");
  } else if (looksDotDecimal) {
    // Dejar el punto como decimal
  } else if (dotThousands) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (commaThousands) {
    s = s.replace(/,/g, "");
  } else if (hasComma && !hasDot) {
    s = s.replace(",", ".");
  }

  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`Precio inválido: ${input}`);
  return n;
}

function median(nums: number[]): number {
  const a = [...nums].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

/** Promedio ponderado por USDT negociables (WMA) de los 3 más baratos */
function wmaTop3Ascending(prices: number[], qtys: number[]): number {
  const n = Math.min(3, prices.length);
  let wSum = 0, w = 0;
  for (let i = 0; i < n; i++) {
    const q = Math.max(0, Number(qtys[i] ?? 0));
    if (q > 0) { wSum += prices[i] * q; w += q; }
  }
  if (w === 0) return prices.slice(0, n).reduce((a, b) => a + b, 0) / n;
  return wSum / w;
}

/* ---------- Binance P2P ---------- */

const BINANCE_URL = "https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search";
const HEADERS: Record<string, string> = {
  accept: "application/json, text/plain, */*",
  "content-type": "application/json",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  clienttype: "web",
  lang: "es",
  origin: "https://p2p.binance.com",
  referer: "https://p2p.binance.com/es/trade/all-payments/USDT?fiat=VES",
};

type Payload = {
  page: number; rows: number; publisherType: null | string;
  asset: "USDT"; tradeType: "BUY" | "SELL"; fiat: "VES"; transAmount?: string;
};

const PAYLOADS: Payload[] = [
  { page: 1, rows: 20, publisherType: null, asset: "USDT", tradeType: "BUY",  fiat: "VES", transAmount: "50" },
  { page: 1, rows: 20, publisherType: null, asset: "USDT", tradeType: "BUY",  fiat: "VES" },
  { page: 1, rows: 20, publisherType: null, asset: "USDT", tradeType: "SELL", fiat: "VES" },
];

async function tryFetchOnce(p: Payload): Promise<{ prices: number[]; qtys: number[] }> {
  const res = await fetch(BINANCE_URL, { method: "POST", headers: HEADERS, body: JSON.stringify(p) });
  if (!res.ok) throw new Error(`Binance ${res.status}`);
  const data: any = await res.json();

  const rows = ((data?.data ?? []) as any[])
    .map((x: any) => {
      const price = parseVESPrice(x?.adv?.price);
      const qty   = Number(x?.adv?.tradableQuantity ?? x?.adv?.surplusAmount ?? 0);
      return { price, qty };
    })
    .filter(r => Number.isFinite(r.price) && r.price > 0)
    .sort((a, b) => a.price - b.price);

  return { prices: rows.map(r => r.price), qtys: rows.map(r => r.qty) };
}

async function fetchBinanceWMAorMedian(maxRetries = 3): Promise<number> {
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    for (const p of PAYLOADS) {
      try {
        const { prices, qtys } = await tryFetchOnce(p);
        if (prices.length >= 3) {
          const wma = wmaTop3Ascending(prices, qtys);
          if (Number.isFinite(wma) && wma > 0) return wma;
        }
        if (prices.length) return median(prices);
      } catch (e) { lastErr = e; }
      await new Promise(r => setTimeout(r, 250));
    }
    await new Promise(r => setTimeout(r, 400 * attempt));
  }
  throw new Error((lastErr as Error | undefined)?.message || "Sin precios VES");
}

/* ---------- API ---------- */

export const GET: APIRoute = async ({ url }) => {
  try {
    const qMock   = url.searchParams.get("mock");
    const envMock = process.env.DEV_FORCE_RATE;

    // Tasa cruda en VES/USDT (~293.xx)
    const raw: number = qMock ? Number(qMock)
                      : envMock ? Number(envMock)
                      : await fetchBinanceWMAorMedian(3);

    // EMA 60/40 con salvaguardas (ignora outliers y resetea si hay salto enorme)
    const last = await prisma.rate.findFirst({ orderBy: { createdAt: "desc" } });
    const prev = last ? Number(last.ema) : null;

    const sane = (n: unknown) => {
      const x = Number(n);
      return Number.isFinite(x) && x > 10 && x < 5000; // rango razonable
    };

    const ema =
      !sane(prev) || !sane(raw) || Math.abs(Number(prev) - Number(raw)) > 500
        ? Number(raw)
        : 0.6 * Number(raw) + 0.4 * Number(prev);

    const saved = await prisma.rate.create({
      data: { raw, ema, source: qMock ? "Mock manual" : envMock ? "DEV_FORCE_RATE" : "Binance P2P" },
    });

    // Formatos listos para UI
    const tasaFmt2     = `${fmtVE2(Number(saved.raw))} VES`;
    const emaFmt2      = `${fmtVE2(Number(saved.ema))} VES`;
    const tasaFmt2Usdt = `${fmtVE2(Number(saved.raw))} VES/USDT`;
    const emaFmt2Usdt  = `${fmtVE2(Number(saved.ema))} VES/USDT`;

    return new Response(
      JSON.stringify({
        tasa: Number(saved.raw),
        ema: Number(saved.ema),
        fuente: saved.source,
        ts: saved.createdAt,
        tasaFmt2, emaFmt2, tasaFmt2Usdt, emaFmt2Usdt,
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  } catch (e: any) {
    // Fallback a cache si existe
    const last = await prisma.rate.findFirst({ orderBy: { createdAt: "desc" } });
    if (last) {
      return new Response(
        JSON.stringify({
          tasa: Number(last.raw),
          ema: Number(last.ema),
          fuente: (last.source || "cache") + " (cache)",
          ts: last.createdAt,
          warning: e?.message || "FX error",
          tasaFmt2: `${fmtVE2(Number(last.raw))} VES`,
          emaFmt2: `${fmtVE2(Number(last.ema))} VES`,
          tasaFmt2Usdt: `${fmtVE2(Number(last.raw))} VES/USDT`,
          emaFmt2Usdt: `${fmtVE2(Number(last.ema))} VES/USDT`,
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }
    return new Response(
      JSON.stringify({ error: e?.message || "FX error (sin cache)" }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
};
