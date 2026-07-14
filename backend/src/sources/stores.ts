import type { StoreConfig } from "./engine.ts";

/**
 * Catálogo declarativo de tiendas. Cada entrada la consume el motor genérico
 * (engine.ts: JSON-LD → microdata → selectores CSS) o el crawler de sitemap
 * (sitemap.ts) si tiene `sitemapUrl`.
 *
 * Verificado contra las webs reales (recon 2026-07-13). Para las tiendas cuyo
 * Cloudflare bloquea el fetch nativo de Node se usa `fetch:{curl:true}`.
 */
export const STORE_CONFIGS: StoreConfig[] = [
  // ---------- Búsqueda directa (rápidas) ----------
  {
    name: "PCComponentes",
    origin: "https://www.pccomponentes.com",
    searchUrl: (t) =>
      `https://www.pccomponentes.com/search/?query=${encodeURIComponent(t)}`,
    fetch: { curl: true, proxied: true }, // Cloudflare bloquea la IP de datacenter de CI (403); enruta por SCRAPER_PROXY si está definido
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
  {
    name: "LDLC",
    origin: "https://www.ldlc.com",
    searchUrl: (t) => `https://www.ldlc.com/es-es/buscar/${encodeURIComponent(t)}/`,
    selectors: {
      item: ".pdt-item",
      name: ".title-3",
      price: ".price",
      link: "a[href*='/es-es/ficha/']",
      stock: ".wrap-stock",
      outOfStockText: "agotado",
    },
    fetch: { curl: true },
  },
  {
    name: "PowerPlanet",
    origin: "https://www.powerplanetonline.com",
    searchUrl: (t) =>
      `https://www.powerplanetonline.com/es/search?searchCriteria=${encodeURIComponent(t)}`,
    selectors: {
      item: ".product-list-outer",
      name: ".productListLink",
      price: ".product-price",
      link: "a.productListLink",
    },
    fetch: { curl: true },
  },
  {
    name: "PCBox",
    origin: "https://www.pcbox.com",
    searchUrl: (t) => `https://www.pcbox.com/${encodeURIComponent(t)}?map=ft`, // VTEX, ld+json
    fetch: { curl: true },
  },
  {
    name: "Speedler",
    origin: "https://www.speedler.es",
    searchUrl: (t) => `https://www.speedler.es/es/buscar/search:${encodeURIComponent(t)}`,
    selectors: {
      item: "div.JS_product.prodGrid2",
      name: "a.JSproductName",
      price: "div.price",
      link: "a.JSproductName",
    },
    fetch: { curl: true },
  },

  // ---------- Por SITEMAP (robots prohíbe la búsqueda; ld+json en ficha) ----------
  {
    name: "Dynos",
    origin: "https://www.dynos.es",
    sitemapUrl: "https://www.dynos.es/sitemap.xml",
    maxProducts: 15,
    fetch: { curl: true, proxied: true },
  },
  {
    name: "Neobyte",
    origin: "https://www.neobyte.es",
    sitemapUrl: "https://www.neobyte.es/sitemap_product.xml",
    maxProducts: 15,
    fetch: { curl: true, proxied: true },
  },

  // MediaMarkt: verificado (ld+json Product en ficha vía sitemap) pero su
  // sitemap son 36+ shards y las fichas pesan ~900KB → demasiado lento para el
  // rastreo cada 3h. Pendiente de optimizar (p. ej. fetch concurrente acotado).
  // VS Gamers: su /search es un SPA que ignora la query; su API typeahead es un
  // autocompletado superficial. Fuente a medida gated en vsgamers.ts.
];
