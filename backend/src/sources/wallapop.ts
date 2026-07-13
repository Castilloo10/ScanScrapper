import type { Listing } from "../types.ts";
import { getJson, guessBrand } from "./util.ts";

/**
 * Wallapop (segunda mano).
 *
 *  ⚠️ AVISO IMPORTANTE:
 *  - Wallapop NO ofrece API pública. Esto usa su API interna, lo cual va
 *    contra sus Términos de Servicio. Úsalo bajo tu responsabilidad.
 *  - Detecta bots por IP y frecuencia. Ve MUY despacio (1 petición cada
 *    varios segundos) y no lo llames en cada carga de página.
 *  - El endpoint y los headers cambian a menudo. Es la fuente más frágil.
 *    Si empieza a devolver 401/403, hay que revisar headers/tokens.
 *
 *  Alternativa legal: no scrapear y quedarte solo con tiendas con API/JSON-LD.
 */
export const NAME = "Wallapop";

interface WpItem {
  id: string;
  title: string;
  price: number;
  web_slug?: string;
}
interface WpResponse {
  search_objects?: { id: string; title: string; price: { amount: number }; web_slug?: string }[];
}

export async function search(term: string): Promise<Listing[]> {
  const url =
    "https://api.wallapop.com/api/v3/general/search?" +
    new URLSearchParams({ keywords: term, filters_source: "search_box", order_by: "price_low_to_high" });

  let data: WpResponse;
  try {
    data = await getJson<WpResponse>(url, {
      headers: { Accept: "application/json", "X-DeviceOS": "0" },
    });
  } catch (e) {
    console.warn(`[Wallapop] fallo (esperable): ${(e as Error).message}`);
    return [];
  }

  return (data.search_objects ?? []).map((o) => ({
    source: NAME,
    externalId: o.id,
    brand: guessBrand(o.title),
    model: o.title,
    price: o.price.amount,
    condition: "usado" as const,
    inStock: true,
    url: o.web_slug ? `https://es.wallapop.com/item/${o.web_slug}` : "https://es.wallapop.com",
  }));
}
