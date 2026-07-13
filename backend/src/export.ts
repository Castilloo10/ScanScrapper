import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { search, facets, closeDb } from "./db.ts";
import { EXPORT_PATH } from "./config.ts";

/**
 * Vuelca la BD a un snapshot estático (products.json) que el frontend consume
 * sin necesidad de un servidor encendido. Esto es lo que hace posible el
 * despliegue 100% gratis 24/7: GitHub Actions rastrea, genera este fichero, y
 * un hosting estático (Cloudflare Pages / GitHub Pages) lo sirve.
 */
const products = search({ limit: 5000, sort: "price-asc" });

// Salvaguarda: si la BD está vacía (p. ej. todas las tiendas bloquearon el
// rastreo desde una IP de CI) NO sobrescribimos un snapshot previo con datos
// buenos. Así un run fallido no deja la web en blanco.
if (products.length === 0 && existsSync(EXPORT_PATH)) {
  closeDb();
  console.warn(`⚠ 0 ofertas: conservo el snapshot existente en ${EXPORT_PATH}`);
  process.exit(0);
}

const snapshot = {
  updatedAt: Math.floor(Date.now() / 1000),
  count: products.length,
  facets: facets(),
  products,
};

mkdirSync(dirname(EXPORT_PATH), { recursive: true });
writeFileSync(EXPORT_PATH, JSON.stringify(snapshot));
closeDb();

console.log(`📦 Snapshot escrito: ${EXPORT_PATH} (${products.length} ofertas)`);
