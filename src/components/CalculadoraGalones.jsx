// src\components\CalculadoraGalones.jsx
import { useState } from "preact/hooks";

/**
 * Calcula galones totales:
 * galones = ((m2 / (m2PorGalon)) * manos) * (1 + perdidas)
 * Defaults típicos fachadas: 120 m²/gal/mano, 2 manos, 10% pérdidas.
 * Además, muestra desglose sugerido en presentaciones de 1 y 5 gal.
 */
export default function CalculadoraGalones() {
  const [m2, setM2] = useState(0);
  const [manos, setManos] = useState(2);
  const [m2PorGalon, setM2PorGalon] = useState(120);
  const [perdidas, setPerdidas] = useState(10); // %

  const calcular = () => {
    const p = Math.max(0, perdidas) / 100;
    const gal = ((Number(m2) || 0) / (Number(m2PorGalon) || 1)) * (Number(manos) || 1) * (1 + p);
    return Math.max(0, gal);
  };

  const gal = calcular();
  const gal5 = Math.floor(gal / 5);
  const gal1 = Math.ceil(gal - gal5 * 5);

  return (
    <div class="border rounded-lg p-4 grid gap-3 max-w-xl">
      <label class="grid gap-1">
        <span>Metros cuadrados (m²)</span>
        <input type="number" class="border rounded p-2" value={m2} onInput={(e)=>setM2(e.currentTarget.value)} />
      </label>

      <div class="grid grid-cols-3 gap-3">
        <label class="grid gap-1">
          <span>Nº de manos</span>
          <input type="number" class="border rounded p-2" value={manos} min="1" onInput={(e)=>setManos(e.currentTarget.value)} />
        </label>
        <label class="grid gap-1">
          <span>Rend. (m²/gal/mano)</span>
          <input type="number" class="border rounded p-2" value={m2PorGalon} min="10" onInput={(e)=>setM2PorGalon(e.currentTarget.value)} />
        </label>
        <label class="grid gap-1">
          <span>Pérdidas (%)</span>
          <input type="number" class="border rounded p-2" value={perdidas} min="0" onInput={(e)=>setPerdidas(e.currentTarget.value)} />
        </label>
      </div>

      <button class="rounded bg-black text-white px-4 py-2 w-fit"
        onClick={(e)=>e.currentTarget.blur()}>
        Recalcular
      </button>

      <div class="text-sm text-neutral-700">
        <p>Necesitas aprox.: <b>{gal.toFixed(2)} gal</b></p>
        <p class="text-xs text-neutral-500">Incluye {perdidas}% de pérdidas.</p>
        <hr class="my-2"/>
        <p>Desglose sugerido: <b>{gal5}</b> × 5 gal + <b>{gal1}</b> × 1 gal</p>
      </div>
    </div>
  );
}
