import type { Listing } from "../types.ts";
import { getJson, canonicalBrand, parsePrice, isRelevant } from "./util.ts";

/**
 * VS Gamers (Versus Gamers). Su página /search es un SPA que ignora la query;
 * la búsqueda real es una API JSON typeahead (robots.txt la permite).
 * Devuelve items con precio, url y flag secondLife (2ª mano).
 */
export const NAME = "VSGamers";
const ORIGIN = "https://www.vsgamers.es";

interface VsItem {
  id: number;
  name: string;
  category?: string;
  url?: string;
  secondLife?: boolean;
  price?: number | string;
}
interface VsResponse {
  items?: VsItem[];
}

export async function search(term: string): Promise<Listing[]> {
  const url = `${ORIGIN}/search/typeahead/?q=${encodeURIComponent(term)}`;
  const data = await getJson<VsResponse>(url);
  const out: Listing[] = [];

  for (const it of data.items ?? []) {
    const price = parsePrice(it.price);
    if (price == null || price <= 0) continue;
    if (!it.name || !isRelevant(it.name, term)) continue;
    out.push({
      source: NAME,
      externalId: String(it.id),
      brand: canonicalBrand(undefined, it.name),
      model: it.name,
      price,
      condition: it.secondLife ? "usado" : "nuevo",
      inStock: true, // el typeahead solo lista productos disponibles
      url: it.url ? `${ORIGIN}${it.url}` : ORIGIN,
    });
  }
  return out;
}
