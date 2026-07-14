import type { Listing } from "../types.ts";
import { scrapeStore } from "./engine.ts";
import { scrapeViaSitemap } from "./sitemap.ts";
import { STORE_CONFIGS } from "./stores.ts";
import * as coolmod from "./coolmod.ts";
import * as game from "./game.ts";
import * as vsgamers from "./vsgamers.ts";
import * as wallapop from "./wallapop.ts";

export interface Source {
  name: string;
  search: (term: string) => Promise<Listing[]>;
}

/**
 * Las tiendas "normales" salen de la config declarativa (stores.ts) a través
 * del motor genérico. Las de búsqueda directa son RÁPIDAS (aptas para búsqueda
 * en vivo); las de sitemap son LENTAS (crawl del sitemap) → solo para el
 * snapshot programado, no para consultas en vivo.
 */
const fastConfigured: Source[] = STORE_CONFIGS.filter((c) => !c.sitemapUrl).map((cfg) => ({
  name: cfg.name,
  search: (term: string) => scrapeStore(cfg, term),
}));
const sitemapConfigured: Source[] = STORE_CONFIGS.filter((c) => c.sitemapUrl).map((cfg) => ({
  name: cfg.name,
  search: (term: string) => scrapeViaSitemap(cfg, term),
}));

/**
 * Fuentes a medida (no encajan en el motor genérico por búsqueda HTML).
 * Ambas están DESACTIVADAS por defecto y se activan por variable de entorno:
 * - VS Gamers (RADAR_ENABLE_VSGAMERS=1): su /search es un SPA que ignora la
 *   query; la única API abierta es el typeahead, que es un autocompletado
 *   superficial (~10 sugerencias difusas) y no la búsqueda real, así que
 *   rinde poco. Código listo por si se encuentra su endpoint de búsqueda real.
 * - Wallapop (RADAR_ENABLE_WALLAPOP=1): 2ª mano vía su API interna, contra sus
 *   ToS y frágil.
 * - Amazon: requiere la Product Advertising API (cuenta de afiliado); omitido.
 */
const custom: Source[] = [
  { name: coolmod.NAME, search: coolmod.search }, // API pública Doofinder
  { name: game.NAME, search: game.search },       // API POST
];
if (process.env.RADAR_ENABLE_VSGAMERS === "1") {
  custom.push({ name: vsgamers.NAME, search: vsgamers.search });
}
if (process.env.RADAR_ENABLE_WALLAPOP === "1") {
  custom.push({ name: wallapop.NAME, search: wallapop.search });
}

/** Todas las fuentes (para el snapshot programado / rastreo completo). */
export const SOURCES: Source[] = [...fastConfigured, ...sitemapConfigured, ...custom];

/** Fuentes rápidas para la BÚSQUEDA EN VIVO (excluye las lentas de sitemap). */
export const LIVE_SOURCES: Source[] = [...fastConfigured, ...custom];
