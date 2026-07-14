import type { Listing } from "../types.ts";
import { getJson, canonicalBrand, parsePrice, isRelevant } from "./util.ts";

/**
 * Coolmod. Su web es un SPA, pero su buscador es la API pública de Doofinder
 * (sin token de auth; solo exige la cabecera Origin). Doofinder lo usan muchas
 * tiendas españolas, así que este patrón es reutilizable.
 */
export const NAME = "Coolmod";
const HASHID = "a5271756a99534c5e04f33f3f35edf93";
const ORIGIN = "https://www.coolmod.com";

interface DfItem {
  title?: string;
  brand?: string;
  best_price?: number;
  sale_price?: number;
  price?: number;
  link?: string;
  availability?: string;
  id?: string;
}

export async function search(term: string): Promise<Listing[]> {
  const url =
    `https://eu1-search.doofinder.com/6/${HASHID}/_search` +
    `?query=${encodeURIComponent(term)}&rpp=48&page=1`;
  const data = await getJson<{ results?: DfItem[] }>(url, {
    headers: { Origin: ORIGIN },
  });

  const out: Listing[] = [];
  for (const it of data.results ?? []) {
    const price = parsePrice(it.best_price ?? it.sale_price ?? it.price);
    if (!it.title || price == null || price <= 0) continue;
    if (!isRelevant(it.title, term)) continue;
    out.push({
      source: NAME,
      externalId: String(it.id ?? it.link ?? it.title),
      brand: canonicalBrand(it.brand, it.title),
      model: it.title,
      price,
      condition: "nuevo",
      inStock: !/agotado|sin stock/i.test(it.availability ?? ""),
      url: it.link ?? ORIGIN,
    });
  }
  return out;
}
