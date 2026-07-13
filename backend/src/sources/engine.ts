import { load, type CheerioAPI } from "cheerio";
import type { Listing, Condition } from "../types.ts";
import {
  getHtml, canonicalBrand, parsePrice, isInStock, isRelevant, type FetchOpts,
} from "./util.ts";

/**
 * Motor de scraping genérico. La estrategia, verificada contra las webs reales
 * en el recon, es en cascada de robustez:
 *   1. JSON-LD (application/ld+json) con @type Product/Offer  ← lo más estable
 *   2. Microdata schema.org (itemprop) como respaldo
 *   3. Selectores CSS a medida de la tienda como último recurso
 *
 * Añadir una tienda = añadir un StoreConfig (ver stores.ts). No hace falta un
 * fichero .ts por tienda.
 */

export interface StoreSelectors {
  /** Contenedor de cada producto en la página de resultados. */
  item: string;
  /** Selectores relativos al contenedor. */
  name: string;
  price: string;
  brand?: string;
  link: string;
  /** Texto/atributo que indica stock (si falta, se asume en stock). */
  stock?: string;
  /** Cómo detectar "sin stock": si el texto de `stock` contiene esto. */
  outOfStockText?: string;
}

export interface StoreConfig {
  name: string;
  /** Base para resolver URLs relativas. */
  origin: string;
  /**
   * Construye la URL de búsqueda a partir del término. Obligatorio salvo que
   * uses `sitemapUrl` (tiendas cuyo robots.txt prohíbe la búsqueda).
   */
  searchUrl?: (term: string) => string;
  /**
   * Modo SITEMAP: para tiendas que prohíben la búsqueda por robots pero tienen
   * ld+json en las fichas. Se enumera el sitemap, se filtran las URLs cuyo slug
   * casa con el término y se lee el ld+json de cada ficha. Ver sitemap.ts.
   */
  sitemapUrl?: string;
  /** Máx. de fichas a leer por término en modo sitemap (educado). Def. 20. */
  maxProducts?: number;
  /** Todo el catálogo de la tienda es de 2ª mano (p. ej. marketplaces). */
  usedByDefault?: boolean;
  /** Selectores CSS de respaldo si no hay datos estructurados. */
  selectors?: StoreSelectors;
  /** Cabeceras/timeout extra por tienda. */
  fetch?: FetchOpts;
  /** Filtro final: descarta ítems que no son hardware relevante, etc. */
  accept?: (l: Listing) => boolean;
}

function absoluteUrl(href: string | undefined, origin: string): string {
  if (!href) return origin;
  try {
    return new URL(href, origin).toString();
  } catch {
    return origin;
  }
}

/** Aplana el grafo JSON-LD a una lista de nodos Product. */
function collectProducts(node: unknown, out: any[]): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const n of node) collectProducts(n, out);
    return;
  }
  const obj = node as Record<string, unknown>;
  const graph = obj["@graph"];
  if (Array.isArray(graph)) collectProducts(graph, out);

  const itemList = obj.itemListElement;
  if (Array.isArray(itemList)) {
    for (const e of itemList) {
      const item = (e as any)?.item ?? e;
      collectProducts(item, out);
    }
  }

  // Product anidado dentro de otra entidad (p. ej. MediaMarkt: BuyAction.object).
  if (obj.object) collectProducts(obj.object, out);
  if (obj.mainEntity) collectProducts(obj.mainEntity, out);

  const type = obj["@type"];
  const isProduct = Array.isArray(type)
    ? type.includes("Product")
    : type === "Product";
  if (isProduct) out.push(obj);
}

function firstOffer(product: any): any | undefined {
  const offers = product.offers;
  if (!offers) return undefined;
  if (Array.isArray(offers)) return offers[0];
  // AggregateOffer → usa lowPrice
  if (offers["@type"] === "AggregateOffer") return offers;
  return offers;
}

function conditionFromSchema(value: string | undefined, used: boolean): Condition {
  const v = (value ?? "").toLowerCase();
  if (v.includes("used") || v.includes("refurb")) return "usado";
  if (v.includes("new")) return "nuevo";
  return used ? "usado" : "nuevo";
}

/** Extrae listings de los bloques JSON-LD de una página. Reutilizado por sitemap.ts. */
export function fromJsonLd($: CheerioAPI, cfg: StoreConfig): Listing[] {
  const products: any[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text() || $(el).text();
    if (!raw.trim()) return;
    try {
      collectProducts(JSON.parse(raw), products);
    } catch {
      /* JSON-LD malformado: ignora */
    }
  });

  const out: Listing[] = [];
  for (const p of products) {
    const offer = firstOffer(p);
    const price = parsePrice(offer?.price ?? offer?.lowPrice ?? p.price);
    if (price == null) continue;
    const name = typeof p.name === "string" ? p.name : "";
    if (!name) continue;
    const brandRaw = typeof p.brand === "string" ? p.brand : p.brand?.name;
    const url = absoluteUrl(offer?.url ?? p.url ?? p["@id"], cfg.origin);
    out.push({
      source: cfg.name,
      externalId: String(p.sku ?? p.mpn ?? p.productID ?? p["@id"] ?? url ?? name),
      brand: canonicalBrand(brandRaw, name),
      model: name.trim(),
      price,
      condition: conditionFromSchema(offer?.itemCondition ?? p.itemCondition, !!cfg.usedByDefault),
      inStock: offer?.availability ? isInStock(String(offer.availability)) : true,
      url,
    });
  }
  return out;
}

/** Respaldo por selectores CSS cuando no hay datos estructurados. */
function fromSelectors($: CheerioAPI, cfg: StoreConfig): Listing[] {
  const sel = cfg.selectors;
  if (!sel) return [];
  const out: Listing[] = [];
  $(sel.item).each((_, el) => {
    const $el = $(el);
    const name = $el.find(sel.name).first().text().trim();
    const price = parsePrice($el.find(sel.price).first().text());
    if (!name || price == null) return;
    // El enlace puede estar DENTRO de la tarjeta o ENVOLVERLA (la tarjeta es
    // hija de un <a>). Probamos descendiente y, si no, ancestro.
    const inside = $el.find(sel.link).first();
    const href = (inside.length ? inside : $el.closest(sel.link)).attr("href");
    const brandRaw = sel.brand ? $el.find(sel.brand).first().text().trim() : undefined;
    let inStock = true;
    if (sel.stock && sel.outOfStockText) {
      const stockText = $el.find(sel.stock).first().text().toLowerCase();
      inStock = !stockText.includes(sel.outOfStockText.toLowerCase());
    }
    const url = absoluteUrl(href, cfg.origin);
    out.push({
      source: cfg.name,
      externalId: url,
      brand: canonicalBrand(brandRaw, name),
      model: name,
      price,
      condition: cfg.usedByDefault ? "usado" : "nuevo",
      inStock,
      url,
    });
  });
  return out;
}

/** Deduplica por externalId conservando el primero. */
function dedupe(listings: Listing[]): Listing[] {
  const seen = new Set<string>();
  const out: Listing[] = [];
  for (const l of listings) {
    const k = `${l.source}::${l.externalId}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(l);
  }
  return out;
}

/** Ejecuta una búsqueda genérica para una tienda configurada. */
export async function scrapeStore(cfg: StoreConfig, term: string): Promise<Listing[]> {
  if (!cfg.searchUrl) return [];
  const html = await getHtml(cfg.searchUrl(term), cfg.fetch);
  const $ = load(html);

  // Extrae por ambas vías y quédate con la que da más cobertura: en muchas
  // páginas de resultados el ld+json solo trae 1 producto destacado mientras
  // que el DOM tiene la lista entera (o viceversa). No mezclamos las dos para
  // no duplicar (sus externalId difieren: sku vs url).
  const viaJsonLd = fromJsonLd($, cfg);
  const viaSelectors = cfg.selectors ? fromSelectors($, cfg) : [];
  let listings = viaSelectors.length > viaJsonLd.length ? viaSelectors : viaJsonLd;

  listings = dedupe(listings).filter((l) => l.price > 0 && isRelevant(l.model, term));
  if (cfg.accept) listings = listings.filter(cfg.accept);
  return listings;
}
