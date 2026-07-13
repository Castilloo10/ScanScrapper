/** User-Agent de navegador real: muchas tiendas bloquean UAs raros o vacíos. */
export const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** Cabeceras que imita un navegador real (reduce bloqueos de Cloudflare UA-gated). */
const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent": UA,
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
  "Sec-Ch-Ua": '"Chromium";v="131", "Not_A Brand";v="24"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"Windows"',
  "Upgrade-Insecure-Requests": "1",
};

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_RETRIES = 2;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface FetchOpts {
  headers?: Record<string, string>;
  timeoutMs?: number;
  retries?: number;
}

/**
 * fetch con timeout, reintentos con backoff exponencial y respeto de
 * Retry-After. Lanza si agota los reintentos. Un 4xx (salvo 429) NO se
 * reintenta: es un error del cliente, no transitorio.
 */
async function fetchWithRetry(url: string, opts: FetchOpts = {}): Promise<Response> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries = opts.retries ?? DEFAULT_RETRIES;
  let lastErr: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: { ...BROWSER_HEADERS, ...opts.headers },
        signal: ac.signal,
        redirect: "follow",
      });
      if (res.ok) return res;

      // Reintenta solo lo transitorio: 429 y 5xx.
      const retriable = res.status === 429 || res.status >= 500;
      if (!retriable || attempt === retries) {
        throw new Error(`${url} → HTTP ${res.status}`);
      }
      const retryAfter = Number(res.headers.get("retry-after"));
      const backoff = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : 500 * 2 ** attempt;
      await sleep(backoff);
    } catch (e) {
      lastErr = e;
      // AbortError o error de red: reintenta con backoff.
      if (attempt === retries) break;
      await sleep(500 * 2 ** attempt);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`${url} → fallo desconocido`);
}

export async function getHtml(url: string, opts: FetchOpts = {}): Promise<string> {
  const res = await fetchWithRetry(url, opts);
  return res.text();
}

export async function getJson<T = unknown>(url: string, opts: FetchOpts = {}): Promise<T> {
  const res = await fetchWithRetry(url, {
    ...opts,
    headers: { Accept: "application/json", ...opts.headers },
  });
  return res.json() as Promise<T>;
}

/** Marcas de hardware conocidas (para deducir la marca del título). */
const BRANDS = [
  "ASUS", "MSI", "Gigabyte", "Zotac", "Palit", "Gainward", "PNY", "Inno3D",
  "Sapphire", "PowerColor", "AMD", "Intel", "NVIDIA", "EVGA", "XFX", "Corsair",
  "Kingston", "Crucial", "Samsung", "Western Digital", "Seagate", "Nox",
  "Acer", "Aorus",
];

/**
 * Canoniza una marca: si el texto contiene (o es) una marca conocida, devuelve
 * su forma canónica; si no, "Genérica". Aplicarlo tanto a la marca declarada
 * por la tienda como a la deducida del título evita buckets duplicados por
 * mayúsculas/variantes.
 */
export function canonicalBrand(raw: string | undefined, title = ""): string {
  const hay = `${raw ?? ""} ${title}`.toLowerCase();
  const hit = BRANDS.find((b) => hay.includes(b.toLowerCase()));
  if (hit) return hit;
  const trimmed = (raw ?? "").trim();
  return trimmed || "Genérica";
}

/** Alias retro-compatible. */
export const guessBrand = (title: string): string => canonicalBrand(undefined, title);

/**
 * "1.234,56 €" → 1234.56 (formato europeo) y "1,234.56" → 1234.56 (anglosajón).
 * Devuelve null si no encuentra un número plausible.
 */
export function parsePrice(input: string | number | undefined | null): number | null {
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  if (!input) return null;
  const text = String(input).replace(/[^\d.,]/g, "");
  if (!text) return null;

  let normalized: string;
  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  if (lastComma > lastDot) {
    // Coma como separador decimal (europeo): quita puntos de millar.
    normalized = text.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma) {
    // Punto como separador decimal: quita comas de millar.
    normalized = text.replace(/,/g, "");
  } else {
    normalized = text;
  }
  const val = parseFloat(normalized);
  return Number.isFinite(val) ? val : null;
}

/**
 * ¿El producto es relevante para el término buscado? Muchas búsquedas devuelven
 * accesorios o modelos cercanos: buscar "Ryzen 7 9800X3D" no debe colar una
 * alfombrilla ni un RTX 3050. Exigimos que el modelo contenga el token "fuerte"
 * del término (el que lleva dígitos, p. ej. "9800x3d" o "5070"); si no hay
 * ninguno, caemos a los tokens largos.
 */
export function isRelevant(model: string, term: string): boolean {
  const words = term.toLowerCase().split(/\s+/).filter(Boolean);
  const strong = words.filter((w) => /\d/.test(w) && w.length >= 3);
  const keys = strong.length ? strong : words.filter((w) => w.length >= 4);
  if (keys.length === 0) return true;
  const hay = model.toLowerCase();
  return keys.some((k) => hay.includes(k));
}

/** ¿La cadena de availability de schema.org indica que hay stock? */
export function isInStock(availability: string | undefined): boolean {
  const a = (availability ?? "").toLowerCase();
  if (!a) return false;
  if (a.includes("outofstock") || a.includes("out_of_stock") || a.includes("soldout") ||
      a.includes("discontinued") || a.includes("backorder")) {
    return false;
  }
  return a.includes("instock") || a.includes("in_stock") ||
    a.includes("limitedavailability") || a.includes("onlineonly") || a.includes("preorder");
}
