import { DatabaseSync } from "node:sqlite";
import { DB_PATH, STALE_STOCK_MIN } from "./config.ts";
import type {
  Listing, SearchQuery, ProductResult, Facets, SortKey,
} from "./types.ts";

export const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

db.exec(`
  CREATE TABLE IF NOT EXISTS listings (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    key               TEXT UNIQUE,          -- source::externalId
    source            TEXT NOT NULL,
    brand             TEXT NOT NULL,
    model             TEXT NOT NULL,
    price             REAL NOT NULL,
    condition         TEXT NOT NULL,
    in_stock          INTEGER NOT NULL,
    url               TEXT NOT NULL,
    first_seen        INTEGER NOT NULL,
    last_seen         INTEGER NOT NULL,     -- última vez visto en un rastreo
    last_price_change INTEGER NOT NULL
  );
`);
db.exec(`
  CREATE TABLE IF NOT EXISTS price_history (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    listing_id INTEGER NOT NULL,
    price      REAL NOT NULL,
    ts         INTEGER NOT NULL,
    FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
  );
`);
// Índices que las consultas de /search realmente pueden usar.
db.exec(`CREATE INDEX IF NOT EXISTS idx_hist      ON price_history(listing_id, ts);`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_source    ON listings(source);`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_brand     ON listings(brand COLLATE NOCASE);`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_condition ON listings(condition);`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_price     ON listings(price);`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_in_stock  ON listings(in_stock);`);

const now = () => Math.floor(Date.now() / 1000);

// ---- Sentencias preparadas reutilizables ----
const selByKey = db.prepare("SELECT id, price FROM listings WHERE key = ?");
const insListing = db.prepare(
  `INSERT INTO listings
     (key, source, brand, model, price, condition, in_stock, url,
      first_seen, last_seen, last_price_change)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
);
const updListing = db.prepare(
  `UPDATE listings
      SET price = ?, brand = ?, model = ?, condition = ?, in_stock = ?, url = ?,
          last_seen = ?,
          last_price_change = CASE WHEN ? = 1 THEN ? ELSE last_price_change END
    WHERE id = ?`,
);
const insHistory = db.prepare(
  "INSERT INTO price_history (listing_id, price, ts) VALUES (?, ?, ?)",
);

/** Inserta o actualiza una oferta y registra el histórico si cambia el precio. */
export function upsertListing(l: Listing): void {
  const key = `${l.source}::${l.externalId}`;
  const stock = l.inStock ? 1 : 0;
  const t = now();
  const existing = selByKey.get(key) as { id: number; price: number } | undefined;

  if (!existing) {
    const info = insListing.run(
      key, l.source, l.brand, l.model, l.price, l.condition, stock, l.url, t, t, t,
    );
    insHistory.run(Number(info.lastInsertRowid), l.price, t);
    return;
  }

  const priceChanged = existing.price !== l.price;
  // A diferencia de la versión original, refrescamos también brand/model/
  // condition: una mala deducción del primer rastreo ya no queda congelada.
  updListing.run(
    l.price, l.brand, l.model, l.condition, stock, l.url,
    t, priceChanged ? 1 : 0, t, existing.id,
  );
  if (priceChanged) insHistory.run(existing.id, l.price, t);
}

/**
 * Marca como agotadas las ofertas de `source` que no se han visto en el último
 * rastreo (last_seen anterior al corte). Así "Solo en stock" no sirve ofertas
 * retiradas indefinidamente. Devuelve cuántas filas marcó.
 */
const markStale = db.prepare(
  `UPDATE listings SET in_stock = 0
     WHERE source = ? AND in_stock = 1 AND last_seen < ?`,
);
export function markUnseenOutOfStock(source: string, cutoffTs: number): number {
  const info = markStale.run(source, cutoffTs);
  return Number(info.changes);
}

export const STALE_CUTOFF_SECS = STALE_STOCK_MIN * 60;

interface Row {
  id: number; key: string; source: string; brand: string; model: string;
  price: number; condition: string; in_stock: number; url: string;
  last_seen: number; first_price: number | null;
}

/** Escapa los comodines LIKE para que %/_ se busquen literalmente. */
function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

const ORDER_BY: Record<SortKey, string> = {
  "price-asc": "price ASC",
  "price-desc": "price DESC",
  // drop = precio inicial − actual (mayor caída primero); NULLS al final.
  "drop": "(first_price - price) DESC",
  "recent": "last_seen DESC",
};

const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 200;
const MAX_Q_WORDS = 12;

/** Busca ofertas aplicando los filtros del frontend. */
export function search(q: SearchQuery): ProductResult[] {
  const where: string[] = [];
  const params: (string | number)[] = [];

  if (q.q) {
    const words = q.q.trim().split(/\s+/).filter(Boolean).slice(0, MAX_Q_WORDS);
    for (const word of words) {
      where.push(`(model || ' ' || brand) LIKE ? ESCAPE '\\'`);
      params.push(`%${escapeLike(word)}%`);
    }
  }
  if (q.priceMin != null && Number.isFinite(q.priceMin)) {
    where.push("price >= ?"); params.push(q.priceMin);
  }
  if (q.priceMax != null && Number.isFinite(q.priceMax)) {
    where.push("price <= ?"); params.push(q.priceMax);
  }
  if (q.condition && q.condition !== "todos") {
    where.push("condition = ?"); params.push(q.condition);
  }
  if (q.stockOnly) where.push("in_stock = 1");
  if (q.brands?.length) {
    where.push(`brand COLLATE NOCASE IN (${q.brands.map(() => "?").join(",")})`);
    params.push(...q.brands);
  }
  if (q.stores?.length) {
    where.push(`source IN (${q.stores.map(() => "?").join(",")})`);
    params.push(...q.stores);
  }

  const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";
  const orderSql = ORDER_BY[q.sort ?? "price-asc"] ?? ORDER_BY["price-asc"];
  const limit = Math.min(Math.max(1, q.limit ?? DEFAULT_LIMIT), MAX_LIMIT);
  const offset = Math.max(0, q.offset ?? 0);

  // first_price (precio más antiguo del histórico) por subconsulta → permite
  // ordenar por "drop" y calcularlo sin traer todo el histórico dos veces.
  const sql = `
    SELECT id, key, source, brand, model, price, condition, in_stock, url, last_seen,
           (SELECT ph.price FROM price_history ph
             WHERE ph.listing_id = listings.id
             ORDER BY ph.ts ASC LIMIT 1) AS first_price
      FROM listings
      ${whereSql}
     ORDER BY ${orderSql}
     LIMIT ? OFFSET ?`;
  const rows = db.prepare(sql).all(...params, limit, offset) as unknown as Row[];
  if (rows.length === 0) return [];

  // Histórico de la página en UNA consulta (evita N+1).
  const ids = rows.map((r) => r.id);
  const histRows = db
    .prepare(
      `SELECT listing_id, price FROM price_history
        WHERE listing_id IN (${ids.map(() => "?").join(",")})
        ORDER BY listing_id ASC, ts ASC`,
    )
    .all(...ids) as unknown as { listing_id: number; price: number }[];

  const histById = new Map<number, number[]>();
  for (const h of histRows) {
    const arr = histById.get(h.listing_id) ?? [];
    arr.push(h.price);
    histById.set(h.listing_id, arr);
  }

  const t = now();
  return rows.map((r) => {
    // Últimos 20 puntos (los más nuevos); el último = precio actual.
    let history = histById.get(r.id) ?? [];
    if (history.length > 20) history = history.slice(-20);
    if (history.length === 0) history = [r.price];
    return {
      id: r.key,
      model: r.model,
      brand: r.brand,
      store: r.source,
      cond: r.condition as ProductResult["cond"],
      price: r.price,
      stock: !!r.in_stock,
      updated: Math.floor((t - r.last_seen) / 86400),
      history,
      url: r.url,
    };
  });
}

/** Vocabulario real de marcas/tiendas con recuentos, para pintar los filtros. */
export function facets(): Facets {
  const brands = db
    .prepare(
      `SELECT brand AS value, COUNT(*) AS count FROM listings
        GROUP BY brand COLLATE NOCASE ORDER BY count DESC`,
    )
    .all() as unknown as { value: string; count: number }[];
  const stores = db
    .prepare(
      `SELECT source AS value, COUNT(*) AS count FROM listings
        GROUP BY source ORDER BY count DESC`,
    )
    .all() as unknown as { value: string; count: number }[];
  const total = (db.prepare("SELECT COUNT(*) AS n FROM listings").get() as { n: number }).n;
  return { brands, stores, total };
}

/** Cierra la BD haciendo checkpoint del WAL (para no perder datos recién escritos). */
export function closeDb(): void {
  try {
    db.exec("PRAGMA wal_checkpoint(TRUNCATE);");
  } catch {
    /* ignora si no hay WAL */
  }
  db.close();
}
