import { runScrape } from "./scrape.ts";
import { CRON_INTERVAL_MIN } from "./config.ts";

/**
 * Modo demonio: rastrea cada CRON_INTERVAL_MIN minutos, para siempre.
 * Úsalo si alojas en un VPS. En serverless usa scrape.ts (una pasada).
 */
console.log(`⏱  Rastreo cada ${CRON_INTERVAL_MIN} min. Primera pasada ahora...`);

let running = false;

async function tick(): Promise<void> {
  if (running) {
    console.warn("⏭  El rastreo anterior sigue en curso; salto esta pasada.");
    return;
  }
  running = true;
  try {
    await runScrape();
  } catch (e) {
    console.error("Error en el rastreo:", (e as Error).message);
  } finally {
    running = false;
  }
}

await tick();
setInterval(tick, CRON_INTERVAL_MIN * 60 * 1000);
