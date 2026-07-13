export type Condition = "nuevo" | "usado";

export type SortKey = "price-asc" | "price-desc" | "drop" | "recent";

/** Mismo shape que devuelve la API /search del backend */
export interface Product {
  id: string;         // identidad estable (source::externalId) → key de React
  model: string;
  brand: string;
  store: string;
  cond: Condition;
  price: number;
  stock: boolean;
  updated: number;    // días desde la última vez que se vio la oferta
  history: number[];  // histórico de precios, ascendente; el último = precio actual
  url: string;
}

export interface Filters {
  q: string;
  priceMin: number | null;
  priceMax: number | null;
  cond: Condition | "todos";
  brands: string[];
  stores: string[];
  stockOnly: boolean;
  sort: SortKey;
}

export const DEFAULT_FILTERS: Filters = {
  q: "",
  priceMin: null,
  priceMax: null,
  cond: "todos",
  brands: [],
  stores: [],
  stockOnly: false,
  sort: "price-asc",
};
