/* eslint-disable @typescript-eslint/no-explicit-any */
import type { APIRoute } from "astro";

/**
 * Util: redondear a 2 decimales como cadena -> número
 */
const round2 = (v: number | null | undefined) =>
  typeof v === "number" && Number.isFinite(v) ? Math.round(v * 100) / 100 : null;

/**
 * Consenso: toma la mediana de los precios disponibles (evita outliers).
 * Si solo hay uno, usa ese.
 */
function consensusFrom(prices: number[]): number | null {
  const xs = prices.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (xs.length === 0) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}

/**
 * EMA “sin estado”: si no tenemos histórico persistente,
 * la mejor aproximación es devolver NOW o un EMA trivial.
 * Aquí lo hacemos opcional mediante `useEMA`.
 */
function emaNow(now: number | null, _alpha: number): number | null {
  // sin buffer de histórico, devolver NOW
  return now;
}

/**
 * ------ FETCHERS ------
 * Todos devuelven (precio:number|null, error?: {status:number, message:string})
 */

async function fetchBinanceVES(params: {
  side: "buy" | "sell";
  bank?: string;
  amount?: number;
}): Promise<{ price: number | null; error?: { status: number; message: string } }> {
  try {
    // Binance P2P (oficial usado por el sitio). Suele aceptar server-side sin cookies.
    const url = "https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search";
    const payload = {
      page: 1,
      rows: 10,
      publisherType: null,
      asset: "USDT",
      tradeType: params.side.toUpperCase(), // BUY o SELL
      fiat: "VES",
      transAmount: params.amount ? String(params.amount) : "",
      // Nota: el filtro por banco se hace vía payTypes, pero no todos los bancos venezolanos están mapeados.
      payTypes: params.bank ? [params.bank] : [],
      countries: [],
      proMerchantAds: false,
    };

    const r = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        // Estos headers ayudan cuando el endpoint se pone quisquilloso:
        "accept-language": "es-ES,es;q=0.9",
        "cache-control": "no-cache",
        "clienttype": "web",
      },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      return { price: null, error: { status: r.status, message: await r.text() } };
    }

    const data: any = await r.json();
    const adv = data?.data?.[0]?.adv;
    const price = adv?.price ? Number(adv.price) : null;
    return { price: round2(price) };
  } catch (e: any) {
    return { price: null, error: { status: 0, message: String(e?.message || e) } };
  }
}

async function fetchOKXVES(params: {
  side: "buy" | "sell";
  amount?: number;
}): Promise<{ price: number | null; error?: { status: number; message: string } }> {
  try {
    // OKX ha cambiado varias veces su endpoint público de P2P.
    // Prueba 1 (clásico). Si devuelve 404, atrapamos y reportamos:
    const side = params.side === "buy" ? "sell" : "buy"; // en libros, lado opuesto del usuario
    const url =
      "https://www.okx.com/v3/c2c/tradingOrders/books" +
      `?quoteCurrency=ves&baseCurrency=usdt&side=${side}` +
      `&paymentMethod=&userType=all&hideOverseasVerificationAds=false&sortType=price_asc&limit=10&offset=0`;

    const r = await fetch(url, {
      headers: {
        "accept-language": "es-ES,es;q=0.9",
        "cache-control": "no-cache",
      },
    });

    if (!r.ok) {
      return { price: null, error: { status: r.status, message: await r.text() } };
    }

    const data: any = await r.json();
    // Estructuras de OKX varían. Intenta varias rutas conocidas:
    const first =
      data?.data?.[0] ??
      data?.data?.buy?.[0] ??
      data?.data?.sell?.[0] ??
      data?.data?.orders?.[0];

    const price =
      first?.price ??
      first?.unitPrice ??
      first?.quotePrice ??
      (typeof first === "object" && first
        ? Number(first.price || first.unitPrice || first.quotePrice)
        : null);

    return { price: round2(Number(price)) };
  } catch (e: any) {
    return { price: null, error: { status: 0, message: String(e?.message || e) } };
  }
}

async function fetchBybitVES(params: {
  side: "buy" | "sell";
  amount?: number;
}): Promise<{ price: number | null; error?: { status: number; message: string } }> {
  try {
    // Bybit también rota endpoints. Este suele funcionar server-side.
    // side=1 BUY, side=0 SELL (en muchos endpoints de Bybit es así).
    const sideNum = params.side === "buy" ? 1 : 0;
    const url =
      "https://api2.bybit.com/fiat/otc/item/online" +
      `?tokenId=USDT&currencyId=VES&side=${sideNum}&payment=0&size=10&page=1` +
      (params.amount ? `&amount=${params.amount}` : "");

    const r = await fetch(url, {
      headers: {
        "accept-language": "es-ES,es;q=0.9",
        "cache-control": "no-cache",
      },
    });

    if (!r.ok) {
      return { price: null, error: { status: r.status, message: await r.text() } };
    }

    const data: any = await r.json();
    const first = data?.result?.items?.[0];
    const price = first?.price ? Number(first.price) : null;
    return { price: round2(price) };
  } catch (e: any) {
    return { price: null, error: { status: 0, message: String(e?.message || e) } };
  }
}

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  // --- Parámetros (con defaults compatibles con tus capturas) ---
  const side = (url.searchParams.get("side") || "buy").toLowerCase() as "buy" | "sell";
  const bank = (url.searchParams.get("bank") || "").trim();
  const min = Number(url.searchParams.get("min") ?? "0");
  const n = Number(url.searchParams.get("n") ?? "0");
  const alpha = Number(url.searchParams.get("alpha") ?? "0.2");
  const pretty = url.searchParams.has("pretty");
  const useEMA = (url.searchParams.get("useEMA") ?? "1") !== "0"; // useEMA=0 -> desactivar EMA

  // --- Llamadas paralelas a los exchanges ---
  const [bRes, oRes, yRes] = await Promise.all([
    fetchBinanceVES({ side, bank, amount: min || undefined }),
    fetchOKXVES({ side, amount: min || undefined }),
    fetchBybitVES({ side, amount: min || undefined }),
  ]);

  const sources: Record<"binance_now" | "okx_now" | "bybit_now", number | null> = {
    binance_now: bRes.price,
    okx_now: oRes.price,
    bybit_now: yRes.price,
  };

  const available = Object.values(sources).filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v),
  );

  const now = round2(consensusFrom(available));
  const ema = useEMA ? round2(emaNow(now, alpha)) : now;
  const rangeLow = now;
  const rangeHigh = now;

  const body = {
    ok: true as const,
    params: { side, bank, min, n, alpha },
    sources,
    consensus: { now, ema, rangeLow, rangeHigh },
    meta: {
      errors: {
        binance: bRes.error ?? {},
        okx: oRes.error ?? {},
        bybit: yRes.error ?? {},
      },
    },
    ts: new Date().toISOString(),
  };

  return new Response(pretty ? JSON.stringify(body, null, 2) : JSON.stringify(body), {
    headers: { "content-type": "application/json; charset=utf-8" },
    status: 200,
  });
};
