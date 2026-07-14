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

import { execFile } from "node:child_process";
import { promisify } from "node:util";
const execFileAsync = promisify(execFile);

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_RETRIES = 2;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Descarga con `curl` como plan B. Algunas tiendas con Cloudflare bloquean la
 * huella TLS del fetch nativo de Node (undici) aunque el User-Agent sea de
 * navegador; curl usa otra huella y pasa (verificado: PCComponentes, Dynos).
 * curl está disponible en Windows 10+, macOS y los runners de GitHub Actions.
 */
function curlBaseArgs(timeoutMs: number, proxy?: string): string[] {
  const args = ["-sS", "-L", "--compressed", "--max-time", String(Math.ceil(timeoutMs / 1000))];
  if (proxy) args.push("--proxy", proxy); // proxy de transporte (p. ej. WARP socks5h://...)
  return args;
}

async function runCurl(args: string[], url: string, timeoutMs: number): Promise<string> {
  args.push("-w", "\n%{http_code}", url);
  const { stdout } = await execFileAsync("curl", args, {
    maxBuffer: 32 * 1024 * 1024,
    timeout: timeoutMs + 5000,
  });
  const nl = stdout.lastIndexOf("\n");
  const status = Number(stdout.slice(nl + 1).trim());
  const body = stdout.slice(0, nl);
  if (status < 200 || status >= 300) throw new Error(`${url} → curl HTTP ${status}`);
  return body;
}

async function curlGet(
  url: string,
  headers: Record<string, string>,
  timeoutMs: number,
  proxy?: string,
): Promise<string> {
  const args = curlBaseArgs(timeoutMs, proxy);
  for (const [k, v] of Object.entries(headers)) args.push("-H", `${k}: ${v}`);
  return runCurl(args, url, timeoutMs);
}

async function curlPost(
  url: string,
  body: string,
  headers: Record<string, string>,
  timeoutMs: number,
  proxy?: string,
): Promise<string> {
  const args = curlBaseArgs(timeoutMs, proxy);
  args.push("-X", "POST", "--data-raw", body);
  for (const [k, v] of Object.entries(headers)) args.push("-H", `${k}: ${v}`);
  return runCurl(args, url, timeoutMs);
}

/**
 * Resuelve el bypass SOLO para tiendas marcadas `proxied` (las que Cloudflare
 * bloquea por IP de datacenter en CI). Prioridad: SCRAPER_PROXY (API de scraping,
 * envuelve la URL) → CURL_PROXY (proxy de transporte, p. ej. WARP). En local sin
 * ninguna de las dos, rastreo directo y gratis.
 */
function resolveProxy(url: string, proxied?: boolean): { target: string; curlProxy?: string } {
  if (!proxied) return { target: url };
  if (process.env.SCRAPER_PROXY) return { target: proxify(url) };
  if (process.env.CURL_PROXY) return { target: url, curlProxy: process.env.CURL_PROXY };
  return { target: url };
}

export interface FetchOpts {
  headers?: Record<string, string>;
  timeoutMs?: number;
  retries?: number;
  /** Ir directo a curl (para tiendas que siempre bloquean el fetch de Node). */
  curl?: boolean;
  /**
   * Enrutar por un proxy de scraping si está configurado (SCRAPER_PROXY). Para
   * tiendas cuyo Cloudflare bloquea la IP de datacenter de CI (403). En local
   * (sin la variable) no cambia nada y se rastrea directo y gratis.
   */
  proxied?: boolean;
}

/**
 * Envuelve la URL con el proxy de scraping si SCRAPER_PROXY está definido.
 * Formato de la variable: una plantilla con {url}, p. ej.
 *   https://api.scrapingant.com/v2/general?url={url}&x-api-key=XXXX
 *   http://api.scraperapi.com/?api_key=XXXX&url={url}
 * Si no lleva {url}, la URL se añade al final (URL-encoded).
 */
function proxify(url: string): string {
  const tpl = process.env.SCRAPER_PROXY;
  if (!tpl) return url;
  return tpl.includes("{url}")
    ? tpl.replace("{url}", encodeURIComponent(url))
    : tpl + encodeURIComponent(url);
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
  const timeout = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const { target, curlProxy } = resolveProxy(url, opts.proxied);
  const viaProxy = target !== url || !!curlProxy;
  if (opts.curl || viaProxy) return curlGet(target, { ...BROWSER_HEADERS, ...opts.headers }, timeout, curlProxy);
  try {
    const res = await fetchWithRetry(url, opts);
    return await res.text();
  } catch (e) {
    // Plan B: curl (mejor huella TLS contra Cloudflare).
    try {
      return await curlGet(url, { ...BROWSER_HEADERS, ...opts.headers }, timeout);
    } catch {
      throw e;
    }
  }
}

export async function getJson<T = unknown>(url: string, opts: FetchOpts = {}): Promise<T> {
  const timeout = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const headers = { Accept: "application/json", ...opts.headers };
  const { target, curlProxy } = resolveProxy(url, opts.proxied);
  const viaProxy = target !== url || !!curlProxy;
  if (opts.curl || viaProxy) {
    return JSON.parse(await curlGet(target, { ...BROWSER_HEADERS, ...headers }, timeout, curlProxy)) as T;
  }
  try {
    const res = await fetchWithRetry(url, { ...opts, headers });
    return (await res.json()) as T;
  } catch (e) {
    try {
      const body = await curlGet(url, { ...BROWSER_HEADERS, ...headers }, timeout);
      return JSON.parse(body) as T;
    } catch {
      throw e;
    }
  }
}

/** POST con cuerpo JSON (para APIs de tienda que solo responden a POST, p. ej. GAME). */
export async function postJson<T = unknown>(
  url: string,
  body: unknown,
  opts: FetchOpts = {},
): Promise<T> {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    Accept: "application/json",
    ...opts.headers,
  };
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  const { curlProxy } = resolveProxy(url, opts.proxied);
  const out = await curlPost(url, payload, { ...BROWSER_HEADERS, ...headers }, opts.timeoutMs ?? DEFAULT_TIMEOUT_MS, curlProxy);
  return JSON.parse(out) as T;
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
  // LDLC y algunos usan el símbolo € como separador decimal: "649€95" = 649,95.
  const pre = String(input).replace(/(\d)\s*€\s*(\d{2})(?!\d)/, "$1,$2");
  const text = pre.replace(/[^\d.,]/g, "");
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
  return keys.some((k) => {
    // Los tokens con dígitos ("5070", "9800x3d") no deben casar como subcadena
    // de otro número: "5070" NO es relevante dentro de "850700" (un EAN/código).
    if (/\d/.test(k)) {
      const esc = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`(?<!\\d)${esc}(?!\\d)`).test(hay);
    }
    return hay.includes(k);
  });
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
