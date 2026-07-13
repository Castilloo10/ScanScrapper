import type { Filters, Product, SortKey } from "../types";

/** Filtra y ordena en cliente. Se usa solo con datos de ejemplo;
 *  con API real, el backend ya devuelve el resultado filtrado. */
export function filterProducts(list: Product[], f: Filters): Product[] {
  const out = list.filter((p) => {
    if (f.q) {
      const hay = `${p.model} ${p.brand}`.toLowerCase();
      if (!f.q.toLowerCase().split(/\s+/).every((t) => hay.includes(t))) return false;
    }
    if (f.priceMin != null && p.price < f.priceMin) return false;
    if (f.priceMax != null && p.price > f.priceMax) return false;
    if (f.cond !== "todos" && p.cond !== f.cond) return false;
    if (f.brands.length && !f.brands.includes(p.brand)) return false;
    if (f.stores.length && !f.stores.includes(p.store)) return false;
    if (f.stockOnly && !p.stock) return false;
    return true;
  });

  const drop = (p: Product) => (p.history.length ? p.history[0] - p.history[p.history.length - 1] : 0);
  const sorters: Record<SortKey, (a: Product, b: Product) => number> = {
    "price-asc": (a, b) => a.price - b.price,
    "price-desc": (a, b) => b.price - a.price,
    "drop": (a, b) => drop(b) - drop(a),
    "recent": (a, b) => a.updated - b.updated,
  };
  return [...out].sort(sorters[f.sort]);
}

/** Puntos del sparkline + color según tendencia. Tolera histórico vacío o de
 *  un solo punto (dibuja una línea plana visible, no un vértice invisible). */
export function sparkline(history: number[], w = 70, h = 22, pad = 2) {
  const data = history.length ? history : [0];
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const midY = h / 2;

  // Con 0/1 puntos no hay pendiente: una línea horizontal de lado a lado.
  const coords =
    data.length < 2
      ? [`${pad},${midY.toFixed(1)}`, `${(w - pad).toFixed(1)},${midY.toFixed(1)}`]
      : data.map((v, i) => {
          const x = pad + (i * (w - pad * 2)) / (data.length - 1);
          const y = pad + (h - pad * 2) * (1 - (v - min) / range);
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        });

  const trend = data[data.length - 1] - data[0];
  const color = trend < 0 ? "var(--good)" : trend > 0 ? "var(--bad)" : "var(--muted-2)";
  return { points: coords.join(" "), color, w, h, flat: data.length < 2 };
}

/** Variación porcentual del histórico. Tolera histórico vacío o base 0. */
export function priceDelta(history: number[]): { text: string; cls: "up" | "down" | "flat" } {
  const first = history[0];
  const last = history[history.length - 1];
  if (history.length < 2 || !first || !Number.isFinite(first)) {
    return { text: "±0%", cls: "flat" };
  }
  const pct = ((last - first) / first) * 100;
  if (Math.abs(pct) < 0.5) return { text: "±0%", cls: "flat" };
  const cls = pct < 0 ? "down" : "up";
  const sign = pct < 0 ? "▾" : "▴";
  return { text: `${sign} ${Math.abs(pct).toFixed(0)}%`, cls };
}
