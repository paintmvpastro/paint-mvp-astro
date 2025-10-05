// src\lib\pricing.ts
// utils de precios: EMA, redondeo y conversión USD->VES
// src/lib/pricing.ts

export type PriceMode = "raw" | "terminaciones";

/** Multiplica USD × FX sin reglas comerciales. */
export function vesRaw(usd: number, fx: number): number {
  if (!isFinite(usd) || !isFinite(fx)) return 0;
  return usd * fx;
}

/**
 * Redondeo comercial con terminaciones .499 / .999 (miles):
 * - Calcula USD×FX y redondea al entero más cercano
 * - Ajusta a la terminación más cercana entre …499 y …999
 * - Si está justo en el medio, sube a …999
 */
export function vesTerminaciones(usd: number, fx: number): number {
  const raw = vesRaw(usd, fx);
  let v = Math.round(raw);
  const tail = v % 1000;
  const to499 = v - tail + 499;
  const to999 = v - tail + 999;
  v = Math.abs(v - to499) <= Math.abs(v - to999) ? to499 : to999;
  return Math.max(v, 0);
}

/** Cálculo unificado según modo. */
export function computeVES(
  usd: number,
  fx: number,
  mode: PriceMode = "terminaciones"
): number {
  return mode === "raw" ? vesRaw(usd, fx) : vesTerminaciones(usd, fx);
}

/** 👉 Wrapper retro-compatible para el código existente en index.astro */
export function precioVES(args: {
  costoBaseUSD: number;
  margen: number;        // ej. 0.30 = 30%
  tasaVES: number;       // consenso/EMA actual
  mode?: PriceMode;      // "raw" | "terminaciones"
}): number {
  const { costoBaseUSD, margen, tasaVES, mode = "terminaciones" } = args;
  const usd = Number(costoBaseUSD) * (1 + Number(margen));
  return computeVES(usd, tasaVES, mode);
}

/** Formatos útiles */
export function formatVES(value: number): string {
  return new Intl.NumberFormat("es-VE", {
    style: "currency",
    currency: "VES",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatUSD(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
