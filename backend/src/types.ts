export type Condition = "nuevo" | "usado";

/** Lo que devuelve cada scraper (una oferta encontrada en una tienda) */
export interface Listing {
  source: string;      // nombre de la tienda: "PCComponentes", "Wallapop"...
  externalId: string;  // id estable dentro de esa tienda (para el upsert)
  brand: string;
  model: string;
  price: number;
  condition: Condition;
  inStock: boolean;
  url: string;
}

export type SortKey = "price-asc" | "price-desc" | "drop" | "recent";

/** Filtros que entiende la API (equivalen a los del frontend) */
export interface SearchQuery {
  q?: string;
  brands?: string[];
  stores?: string[];
  condition?: Condition | "todos";
  priceMin?: number;
  priceMax?: number;
  stockOnly?: boolean;
  sort?: SortKey;
  limit?: number;
  offset?: number;
}

/** Lo que devuelve la API — mismo shape que el array PRODUCTS del frontend */
export interface ProductResult {
  id: string;           // identidad estable (source::externalId) → key de React
  model: string;
  brand: string;
  store: string;
  cond: Condition;
  price: number;
  stock: boolean;
  updated: number;      // días desde la última vez que se vio la oferta
  history: number[];    // histórico de precios, ascendente; el último = precio actual
  url: string;
}

/** Recuento de una faceta (marca o tienda) para pintar los filtros */
export interface FacetCount {
  value: string;
  count: number;
}

/** Vocabulario real de filtros, derivado de la BD (no del mock) */
export interface Facets {
  brands: FacetCount[];
  stores: FacetCount[];
  total: number;
}
