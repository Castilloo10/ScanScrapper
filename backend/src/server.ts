import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { facets } from "./db.ts";
import { liveSearch } from "./live.ts";
import { PORT } from "./config.ts";
import type { Condition, SearchQuery, SortKey } from "./types.ts";

const app = new Hono();

// API pública de solo lectura → CORS abierto por defecto; se puede acotar con
// ALLOWED_ORIGIN (lista separada por comas).
const allowed = process.env.ALLOWED_ORIGIN?.split(",").map((s) => s.trim());
app.use("/*", cors({ origin: allowed && allowed.length ? allowed : "*" }));

app.get("/health", (c) => c.json({ ok: true }));

const VALID_SORT: SortKey[] = ["price-asc", "price-desc", "drop", "recent"];
const VALID_COND: (Condition | "todos")[] = ["nuevo", "usado", "todos"];

/** Convierte un query param en número finito, o devuelve un error legible. */
function numParam(raw: string | undefined): { value?: number; error?: string } {
  if (raw == null || raw === "") return {};
  const n = Number(raw);
  if (!Number.isFinite(n)) return { error: `"${raw}" no es un número válido` };
  if (n < 0) return { error: `"${raw}" no puede ser negativo` };
  return { value: n };
}

/**
 * GET /search?q=RTX+5070+Ti&brand=ASUS&brand=MSI&store=PCComponentes
 *              &min=600&max=900&cond=nuevo&stock=1&sort=price-asc&limit=200
 * Devuelve el mismo shape que consume el frontend (array de ProductResult).
 */
app.get("/search", async (c) => {
  const p = c.req.query();
  const list = (key: string) => c.req.queries(key) ?? [];

  const min = numParam(p.min);
  const max = numParam(p.max);
  const limit = numParam(p.limit);
  const offset = numParam(p.offset);
  const errors: string[] = [];
  if (min.error) errors.push(`min: ${min.error}`);
  if (max.error) errors.push(`max: ${max.error}`);
  if (limit.error) errors.push(`limit: ${limit.error}`);
  if (offset.error) errors.push(`offset: ${offset.error}`);

  const cond = (p.cond ?? "todos") as Condition | "todos";
  if (!VALID_COND.includes(cond)) errors.push(`cond: "${p.cond}" no es válido`);

  const sort = (p.sort ?? "price-asc") as SortKey;
  if (!VALID_SORT.includes(sort)) errors.push(`sort: "${p.sort}" no es válido`);

  if (errors.length) return c.json({ error: "Parámetros inválidos", details: errors }, 400);

  const q: SearchQuery = {
    q: p.q,
    brands: list("brand"),
    stores: list("store"),
    condition: cond,
    priceMin: min.value,
    priceMax: max.value,
    stockOnly: p.stock === "1" || p.stock === "true",
    sort,
    limit: limit.value,
    offset: offset.value,
  };

  // Búsqueda EN VIVO: rastrea el término en las tiendas al vuelo (con caché).
  const result = await liveSearch(q);
  return c.json(result.products);
});

/** Vocabulario real de filtros (marcas/tiendas con recuentos) desde la BD. */
app.get("/facets", (c) => c.json(facets()));

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`🛰  API en http://localhost:${info.port}`);
});
