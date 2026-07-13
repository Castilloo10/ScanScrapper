import type { StoreConfig } from "./engine.ts";

/**
 * Catálogo declarativo de tiendas. Cada entrada la consume el motor genérico
 * (engine.ts): JSON-LD → microdata → selectores CSS.
 *
 * Estado (según recon 2026-07-13 contra las webs reales):
 *  - PCComponentes: JSON-LD en resultados. Ancla del proyecto.
 *  - Alternate.es:  selectores CSS verificados; robots permite /listing.xhtml.
 *  - VS Gamers:     página de búsqueda SSR; robots totalmente abierto.
 *
 * Pendientes (necesitan rastreo por SITEMAP porque su robots.txt prohíbe la
 * búsqueda) → se añadirán con el crawler de sitemap:
 *  - MediaMarkt.es (JSON-LD verificado, ClaudeBot permitido)
 *  - Dynos.es       (JSON-LD, catálogo vivo)
 *  - Neobyte.es     (PrestaShop, JSON-LD en ficha)
 */
export const STORE_CONFIGS: StoreConfig[] = [
  {
    name: "PCComponentes",
    origin: "https://www.pccomponentes.com",
    searchUrl: (t) =>
      `https://www.pccomponentes.com/search/?query=${encodeURIComponent(t)}`,
  },
  {
    name: "Alternate",
    origin: "https://www.alternate.es",
    searchUrl: (t) =>
      `https://www.alternate.es/listing.xhtml?q=${encodeURIComponent(t)}`,
    selectors: {
      item: ".productBox",
      name: ".product-name",
      price: ".price",
      link: "a[href*='/html/product/']",
      stock: ".delivery-info",
      outOfStockText: "agotado",
    },
  },
  // VS Gamers NO va aquí: su /search HTML es un SPA que ignora la query y
  // devuelve un listado genérico. Su búsqueda real es una API JSON typeahead,
  // así que vive como fuente a medida en vsgamers.ts.
];
