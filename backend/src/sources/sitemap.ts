import { load } from "cheerio";
import type { Listing } from "../types.ts";
import { getHtml, isRelevant, type FetchOpts } from "./util.ts";
import { fromJsonLd, type StoreConfig } from "./engine.ts";

/**
 * Modo SITEMAP: para tiendas cuyo robots.txt prohíbe la búsqueda pero publican
 * un sitemap de productos y ld+json en cada ficha (MediaMarkt, Dynos, Neobyte…).
 * Estrategia educada: enumeramos el sitemap UNA vez por ejecución, filtramos las
 * URLs cuyo slug casa con el término (sin descargar todo el catálogo) y leemos el
 * ld+json solo de esas fichas, con un tope por término.
 */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Cache de URLs de producto por sitemap, para no re-enumerar en cada término.
const urlCache = new Map<string, string[]>();

function extractLocs(xml: string): string[] {
  const out: string[] = [];
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) out.push(m[1]);
  return out;
}

/** Enumera todas las URLs de producto de un sitemap (índice o urlset). */
async function allProductUrls(sitemapUrl: string, fetchOpts?: FetchOpts): Promise<string[]> {
  const cached = urlCache.get(sitemapUrl);
  if (cached) return cached;

  const xml = await getHtml(sitemapUrl, fetchOpts);
  let urls: string[];

  if (/<sitemapindex/i.test(xml)) {
    // Es un índice → sus <loc> son sitemaps hijos. Priorizamos los de productos.
    const children = extractLocs(xml);
    const productChildren = children.filter((u) => /product/i.test(u));
    const use = (productChildren.length ? productChildren : children).slice(0, 30);
    urls = [];
    for (const child of use) {
      try {
        urls.push(...extractLocs(await getHtml(child, fetchOpts)));
      } catch {
        /* un sitemap hijo caído no tumba al resto */
      }
    }
  } else {
    urls = extractLocs(xml);
  }

  urlCache.set(sitemapUrl, urls);
  return urls;
}

/** Texto del slug de una URL, para casar con el término buscado. */
function slugText(url: string): string {
  try {
    const path = new URL(url).pathname;
    return decodeURIComponent(path).toLowerCase().replace(/[-_/]+/g, " ");
  } catch {
    return url.toLowerCase();
  }
}

/** Rastrea una tienda por su sitemap para un término. */
export async function scrapeViaSitemap(cfg: StoreConfig, term: string): Promise<Listing[]> {
  if (!cfg.sitemapUrl) return [];
  const all = await allProductUrls(cfg.sitemapUrl, cfg.fetch);
  const matches = all
    .filter((u) => isRelevant(slugText(u), term))
    .slice(0, cfg.maxProducts ?? 20);

  const out: Listing[] = [];
  for (const url of matches) {
    try {
      const html = await getHtml(url, cfg.fetch);
      const $ = load(html);
      const listings = fromJsonLd($, cfg);
      const l = listings[0];
      // Doble filtro por el modelo real del ld+json (el slug es aproximado).
      if (l && isRelevant(l.model, term)) out.push({ ...l, url });
      await sleep(250); // educado entre fichas
    } catch {
      /* ficha caída: sigue con las demás */
    }
  }
  return out;
}
