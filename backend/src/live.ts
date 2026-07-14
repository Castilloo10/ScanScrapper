import { LIVE_SOURCES } from "./sources/index.ts";
import { upsertListing, search } from "./db.ts";
import type { ProductResult, SearchQuery } from "./types.ts";

/**
 * Búsqueda EN VIVO: rastrea cualquier término en las tiendas rápidas al vuelo,
 * lo guarda en la BD (acumula histórico y deduplica) y devuelve el resultado
 * filtrado/ordenado. Con caché por consulta para no re-rastrear lo mismo.
 */

const LIVE_TTL = 10 * 60; // s: no re-rastrear la misma consulta dentro de esta ventana
const PER_STORE_TIMEOUT = 12_000; // ms: una tienda lenta no bloquea la búsqueda
const lastScraped = new Map<string, number>();

const now = () => Math.floor(Date.now() / 1000);
const normalize = (q: string) => q.trim().toLowerCase().replace(/\s+/g, " ");

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)),
  ]);
}

/** ¿Merece la pena re-rastrear esta consulta? (no si se hizo hace poco). */
function isFresh(key: string): boolean {
  return (lastScraped.get(key) ?? 0) > now() - LIVE_TTL;
}

export interface LiveResult {
  products: ProductResult[];
  scraped: boolean; // true si se rastreó en vivo (false si vino de caché)
  stores: { name: string; found: number; ok: boolean }[];
}

export async function liveSearch(q: SearchQuery): Promise<LiveResult> {
  const query = (q.q ?? "").trim();
  const stores: LiveResult["stores"] = [];

  if (query && !isFresh(normalize(query))) {
    const settled = await Promise.allSettled(
      LIVE_SOURCES.map(async (s) => {
        const listings = await withTimeout(s.search(query), PER_STORE_TIMEOUT);
        return { name: s.name, listings };
      }),
    );
    for (let i = 0; i < settled.length; i++) {
      const r = settled[i];
      if (r.status === "fulfilled") {
        for (const l of r.value.listings) upsertListing(l);
        stores.push({ name: r.value.name, found: r.value.listings.length, ok: true });
      } else {
        stores.push({ name: LIVE_SOURCES[i].name, found: 0, ok: false });
      }
    }
    lastScraped.set(normalize(query), now());
    return { products: search(q), scraped: true, stores };
  }

  // Sin término o consulta reciente → responde desde la BD.
  return { products: search(q), scraped: false, stores };
}
