// src\lib\pricing.ts
// utils de precios: EMA, redondeo y conversión USD->VES
export function ema(actual: number, previa: number | null, alpha = 0.3) {
  return previa == null ? actual : alpha * actual + (1 - alpha) * previa;
}

export function redondearVES(v: number) {
  const step = v < 20000 ? 500 : 1000;      // múltiplos comerciales
  const base = Math.round(v / step) * step;
  return base >= 2000 ? base - 1 : base;    // termina en 99 si aplica
}

export function precioVES({
  costoBaseUSD, margen = 0.35, tasaVES, ajuste = 0.005
}: {costoBaseUSD:number; margen:number; tasaVES:number; ajuste?:number}) {
  const precioUSD = costoBaseUSD * (1 + margen);
  const tasaAjustada = tasaVES * (1 + ajuste); // fricción operativa
  return redondearVES(precioUSD * tasaAjustada);
}
