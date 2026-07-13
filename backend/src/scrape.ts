import { SEARCH_TERMS } from "./config.ts";
import { SOURCES } from "./sources/index.ts";
import {
  db, upsertListing, markUnseenOutOfStock, closeDb, STALE_CUTOFF_SECS,
} from "./db.ts";
import type { Listing } from "./types.ts";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const now = () => Math.floor(Date.now() / 1000);

export interface ScrapeReport {
  total: number;
  perSource: Record<string, { found: number; ok: boolean; markedStale: number }>;
}

/**
 * Rastrea cada tienda (todos los términos), aislando fallos por tienda para que
 * una caída no arrastre a las demás. Solo marca agotado lo no visto cuando la
 * tienda respondió con resultados (un rastreo vacío suele ser un bloqueo, no
 * "no hay stock").
 */
export async function runScrape(): Promise<ScrapeReport> {
  const report: ScrapeReport = { total: 0, perSource: {} };

  for (const source of SOURCES) {
    const runStart = now();
    const listings: Listing[] = [];
    let ok = true;
    let hadError = false;

    for (const term of SEARCH_TERMS) {
      try {
        const found = await source.search(term);
        listings.push(...found);
        console.log(`· ${source.name} · "${term}" → ${found.length}`);
      } catch (e) {
        hadError = true;
        console.warn(`✗ ${source.name} · "${term}": ${(e as Error).message}`);
      }
      await sleep(3000); // sé educado: 3s entre peticiones
    }

    // Persistencia atómica por tienda.
    let markedStale = 0;
    if (listings.length > 0) {
      db.exec("BEGIN");
      try {
        for (const l of listings) upsertListing(l);
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        ok = false;
        console.error(`✗ ${source.name}: fallo al guardar → ${(e as Error).message}`);
      }
      // Solo caducamos stock si esta tienda respondió de verdad.
      if (ok) markedStale = markUnseenOutOfStock(source.name, runStart - STALE_CUTOFF_SECS);
    } else {
      ok = false;
      console.warn(
        `⚠ ${source.name}: 0 ofertas (posible bloqueo o cambio de layout; no se toca el stock)`,
      );
    }

    report.perSource[source.name] = { found: listings.length, ok: ok && !hadError, markedStale };
    report.total += listings.length;
    console.log(
      `${ok && !hadError ? "✓" : "⚠"} ${source.name}: ${listings.length} ofertas` +
        (markedStale ? `, ${markedStale} marcadas agotadas` : ""),
    );
  }

  console.log(`\nTotal: ${report.total} ofertas procesadas`);
  return report;
}

// Ejecutar una vez y salir (ideal para GitHub Actions / cron del sistema).
if (import.meta.main) {
  try {
    await runScrape();
  } finally {
    closeDb(); // checkpoint del WAL: no perder lo recién escrito
  }
  process.exit(0);
}
