import type { Condition, Filters, Product } from "./types";
import type { Facet } from "./lib/stores";
import { facets as deriveFacets } from "./lib/stores";

/**
 * Dos modos, sin datos de ejemplo:
 *  - "static" (por defecto): carga un snapshot products.json que genera el
 *    backend (GitHub Actions) y filtra en cliente. Es lo que permite alojar
 *    todo gratis 24/7 sin servidor encendido.
 *  - "api": si defines VITE_API_URL, consulta el backend Hono en vivo
 *    (/search + /facets) filtrando en servidor.
 */
const API = import.meta.env.VITE_API_URL as string | undefined;
const DATA_URL =
  (import.meta.env.VITE_DATA_URL as string | undefined) ??
  `${import.meta.env.BASE_URL}products.json`;

export const MODE: "api" | "static" = API ? "api" : "static";

export interface FacetSet {
  brands: Facet[];
  stores: Facet[];
}

export interface Snapshot {
  updatedAt: number | null;
  products: Product[];
  facets: FacetSet;
}

const CONDS: Condition[] = ["nuevo", "usado"];

/** Normaliza/valida un producto recibido; descarta lo que no tenga forma válida. */
function normalizeProduct(raw: unknown): Product | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const price = typeof o.price === "number" ? o.price : Number(o.price);
  if (!Number.isFinite(price)) return null;
  const model = typeof o.model === "string" ? o.model : "";
  if (!model) return null;

  const history = Array.isArray(o.history)
    ? o.history.map(Number).filter((n) => Number.isFinite(n))
    : [];
  const cond = CONDS.includes(o.cond as Condition) ? (o.cond as Condition) : "nuevo";
  const store = typeof o.store === "string" ? o.store : "—";
  const id = typeof o.id === "string" && o.id ? o.id : `${store}::${model}`;

  return {
    id,
    model,
    brand: typeof o.brand === "string" ? o.brand : "Genérica",
    store,
    cond,
    price,
    stock: Boolean(o.stock),
    updated: typeof o.updated === "number" ? o.updated : 0,
    history: history.length ? history : [price],
    url: typeof o.url === "string" ? o.url : "#",
  };
}

function parseProducts(json: unknown): Product[] {
  if (!Array.isArray(json)) throw new Error("Formato de catálogo inesperado.");
  return json.map(normalizeProduct).filter((p): p is Product => p !== null);
}

function toParams(f: Filters): string {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.priceMin != null) p.set("min", String(f.priceMin));
  if (f.priceMax != null) p.set("max", String(f.priceMax));
  if (f.cond !== "todos") p.set("cond", f.cond);
  if (f.stockOnly) p.set("stock", "1");
  p.set("sort", f.sort);
  f.brands.forEach((b) => p.append("brand", b));
  f.stores.forEach((s) => p.append("store", s));
  return p.toString();
}

// ---- Modo estático ----

/** Carga el snapshot completo (products.json). Lanza si no está disponible. */
export async function fetchSnapshot(signal?: AbortSignal): Promise<Snapshot> {
  const res = await fetch(DATA_URL, { signal });
  if (!res.ok) throw new Error(`No se pudo cargar el catálogo (HTTP ${res.status}).`);
  const json = (await res.json()) as Record<string, unknown>;
  const products = parseProducts(Array.isArray(json) ? json : json.products);
  const facets =
    (json.facets as FacetSet | undefined) ??
    (() => {
      const f = deriveFacets(products);
      return { brands: f.brands, stores: f.stores };
    })();
  const updatedAt = typeof json.updatedAt === "number" ? json.updatedAt : null;
  return { updatedAt, products, facets };
}

// ---- Modo API en vivo ----

export async function fetchProductsApi(f: Filters, signal?: AbortSignal): Promise<Product[]> {
  const res = await fetch(`${API}/search?${toParams(f)}`, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseProducts(await res.json());
}

export async function fetchFacetsApi(signal?: AbortSignal): Promise<FacetSet> {
  const res = await fetch(`${API}/facets`, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as { brands?: Facet[]; stores?: Facet[] };
  return {
    brands: Array.isArray(json.brands) ? json.brands : [],
    stores: Array.isArray(json.stores) ? json.stores : [],
  };
}
