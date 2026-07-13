import type { Product } from "../types";

export const STORE_COLORS: Record<string, { bg: string; fg: string }> = {
  "PCComponentes": { bg: "rgba(255,109,0,.15)", fg: "#ff8a3d" },
  "Coolmod": { bg: "rgba(0,150,255,.15)", fg: "#4aa8ff" },
  "Amazon.es": { bg: "rgba(255,153,0,.15)", fg: "#ffb24a" },
  "VSGamers": { bg: "rgba(155,89,255,.15)", fg: "#b083ff" },
  "Alternate": { bg: "rgba(0,120,215,.15)", fg: "#4c9bff" },
  "Dynos": { bg: "rgba(255,196,0,.15)", fg: "#ffcf4a" },
  "Neobyte": { bg: "rgba(0,200,150,.15)", fg: "#3ddba0" },
  "Wipoid": { bg: "rgba(255,80,120,.15)", fg: "#ff7a95" },
  "MediaMarkt": { bg: "rgba(230,30,50,.15)", fg: "#f26b7a" },
  "El Corte Inglés": { bg: "rgba(120,220,90,.15)", fg: "#8fd66a" },
  "Wallapop": { bg: "rgba(19,191,17,.15)", fg: "#4fd18a" },
};

export function storeColor(store: string) {
  return STORE_COLORS[store] ?? { bg: "rgba(255,255,255,.08)", fg: "#aaa" };
}

export interface Facet {
  value: string;
  count: number;
}

/** Cuenta marcas y tiendas disponibles (para los filtros) */
export function facets(list: Product[]): { brands: Facet[]; stores: Facet[] } {
  const countBy = (pick: (p: Product) => string): Facet[] => {
    const m: Record<string, number> = {};
    for (const p of list) m[pick(p)] = (m[pick(p)] ?? 0) + 1;
    return Object.keys(m).sort().map((value) => ({ value, count: m[value] }));
  };
  return { brands: countBy((p) => p.brand), stores: countBy((p) => p.store) };
}
