import { join } from "node:path";

/**
 * Qué productos vigila el rastreador. Añade los términos que quieras seguir.
 * El worker (scrape.ts) recorre cada término en cada tienda.
 */
export const SEARCH_TERMS = [
  "RTX 5070 Ti",
  "RTX 5070",
  "RTX 5080",
  "Ryzen 7 9800X3D",
];

/** Cada cuánto rastrea el modo cron (minutos) */
export const CRON_INTERVAL_MIN = 30;

/**
 * Ruta del fichero SQLite. Por defecto se resuelve contra la carpeta del
 * backend (no contra el CWD), para que arrancar la API desde cualquier
 * directorio abra siempre la MISMA base de datos y no cree una vacía.
 */
export const DB_PATH =
  process.env.DB_PATH ?? join(import.meta.dirname, "..", "radar.sqlite");

/** Puerto de la API */
export const PORT = Number(process.env.PORT ?? 3000);

/**
 * Dónde se escribe el snapshot estático (products.json) que consume el
 * frontend en modo "sin servidor" (despliegue 100% gratis). Por defecto, la
 * carpeta public del frontend, para que Vite lo sirva tal cual.
 */
export const EXPORT_PATH =
  process.env.EXPORT_PATH ??
  join(import.meta.dirname, "..", "..", "frontend", "public", "products.json");

/**
 * Marca un listado como "agotado" si no aparece en un rastreo desde hace
 * más de estos minutos (evita que ofertas retiradas figuren en stock para
 * siempre). Debe ser mayor que CRON_INTERVAL_MIN.
 */
export const STALE_STOCK_MIN = Math.max(CRON_INTERVAL_MIN * 2, 90);
