import type { Listing } from "../types.ts";
import { postJson, canonicalBrand, parsePrice, isRelevant } from "./util.ts";

/**
 * GAME España. Su búsqueda es una API JSON por POST (el cuerpo debe ir completo;
 * si mandas un objeto parcial devuelve la cáscara HTML).
 */
export const NAME = "GAME";
const ORIGIN = "https://www.game.es";

interface GameOffer { SellPrice?: number; ButtonText?: string; }
interface GameProduct {
  Name?: string;
  Navigation?: string;
  Publisher?: string;
  IsAvailable?: boolean;
  Offers?: GameOffer[];
}

export async function search(term: string): Promise<Listing[]> {
  const body = {
    MinPrice: null, MaxPrice: null, Head: term, SKU: null,
    Order: 7, CategoryFilter: [], Category: null, TotalPages: null, Page: 0,
  };
  const data = await postJson<{ Products?: GameProduct[] }>(`${ORIGIN}/api/search`, body);

  const out: Listing[] = [];
  for (const p of data.Products ?? []) {
    const price = parsePrice(p.Offers?.[0]?.SellPrice);
    if (!p.Name || price == null || price <= 0) continue;
    if (!isRelevant(p.Name, term)) continue;
    out.push({
      source: NAME,
      externalId: p.Navigation ?? p.Name,
      brand: canonicalBrand(p.Publisher, p.Name),
      model: p.Name,
      price,
      condition: "nuevo",
      inStock: p.IsAvailable !== false,
      url: p.Navigation ? `${ORIGIN}/${p.Navigation.replace(/^\//, "")}` : ORIGIN,
    });
  }
  return out;
}
