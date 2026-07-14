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
 * del motor genérico. Para añadir una tienda, edita stores.ts — no hace falta
 * un fichero nuevo.
 */
const configured: Source[] = STORE_CONFIGS.map((cfg) => ({
  name: cfg.name,
  search: (term: string) =>
    cfg.sitemapUrl ? scrapeViaSitemap(cfg, term) : scrapeStore(cfg, term),
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

export const SOURCES: Source[] = [...configured, ...custom];
