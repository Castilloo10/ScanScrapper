# RADAR · backend

Rastreador de precios/stock para tiendas españolas. **Node 24 + TypeScript + Hono + SQLite.**

El worker rastrea cada tienda, guarda precio + timestamp (de ahí sale el histórico
real) y la API expone `/search` con los mismos filtros que el frontend.

```
src/
  config.ts        → qué productos vigilar, puerto, ruta de la BD
  types.ts         → tipos compartidos con el frontend
  db.ts            → SQLite (node:sqlite): upsert + histórico + búsqueda + facetas
  scrape.ts        → worker: rastrea una vez y sale
  cron.ts          → worker: rastrea en bucle (para VPS)
  server.ts        → API Hono (GET /search, /facets, /health)
  sources/
    engine.ts      → motor genérico: JSON-LD → microdata → selectores CSS
    stores.ts      → catálogo declarativo de tiendas (añade tiendas AQUÍ)
    util.ts        → fetch con reintentos/timeout, parseo de precio y marca
    wallapop.ts    → fuente a medida (2ª mano, opcional, ver abajo)
```

## Requisitos

- **Node.js 24+** (usa `node:sqlite` integrado y ejecución nativa de TypeScript;
  no hace falta Bun ni compilar). Comprueba con `node -v`.

## Arrancar en local

```bash
# 1. Dependencias
npm install

# 2. Rastrea una vez (llena la BD)
npm run scrape

# 3. Levanta la API
npm run dev        # http://localhost:3000/search?q=RTX+5070+Ti
```

Scripts: `dev` (API con recarga), `start` (API), `scrape` (una pasada),
`cron` (bucle), `typecheck`.

## API

- `GET /search` — filtros: `q`, `brand` (repetible), `store` (repetible),
  `min`, `max`, `cond` (`nuevo|usado|todos`), `stock=1`, `sort`
  (`price-asc|price-desc|drop|recent`), `limit`, `offset`. Valida y responde
  **400** ante parámetros inválidos. Devuelve un array de
  `{ id, model, brand, store, cond, price, stock, updated, history, url }`.
- `GET /facets` — vocabulario real de marcas y tiendas con recuentos (lo usa el
  frontend para pintar los filtros sin inventárselos).
- `GET /health` — `{ ok: true }`.

## Añadir tiendas

La forma normal es **declarativa**: añade un `StoreConfig` en
`src/sources/stores.ts`. El motor genérico (`engine.ts`) intenta, por orden:

1. **JSON-LD** (`application/ld+json`, `@type: Product/Offer`) — lo más estable.
2. **Microdata** schema.org (`itemprop`).
3. **Selectores CSS** a medida (campo `selectors`), solo si lo anterior falla.

```ts
{
  name: "MiTienda",
  origin: "https://www.mitienda.es",
  searchUrl: (t) => `https://www.mitienda.es/buscar?q=${encodeURIComponent(t)}`,
  // selectors: { item, name, price, link, stock, outOfStockText }  // opcional
}
```

Fuentes a medida (que no encajan en el motor) van como módulo propio en
`sources/` y se registran en `sources/index.ts`. Ejemplo: `wallapop.ts`.

> **Verificación:** los selectores y shapes se validaron contra el HTML real en
> el recon de julio 2026, pero las tiendas cambian. Si una fuente empieza a
> devolver 0 ofertas, el worker lo avisa (`⚠ ... 0 ofertas`) sin tocar el stock
> existente. Revisa entonces su `StoreConfig`.

### Tiendas y su mecanismo (recon 2026-07-13)

| Tienda | Mecanismo | Estado |
|---|---|---|
| PCComponentes | JSON-LD en búsqueda | activa |
| Alternate.es | selectores CSS (robots permite `/listing.xhtml`) | activa |
| VS Gamers | página de búsqueda SSR | activa |
| MediaMarkt.es | JSON-LD vía **sitemap** (robots prohíbe búsqueda) | pendiente crawler sitemap |
| Dynos.es | JSON-LD vía **sitemap** | pendiente crawler sitemap |
| Neobyte.es | JSON-LD vía **sitemap** | pendiente crawler sitemap |
| Wallapop | API interna (2ª mano) | opcional, `RADAR_ENABLE_WALLAPOP=1` |
| Amazon.es | Product Advertising API (afiliado) | no incluida |

## Avisos

- **Wallapop** usa su API interna → va contra sus términos y es frágil.
  Desactivada salvo `RADAR_ENABLE_WALLAPOP=1`.
- **Amazon** → requiere la Product Advertising API (cuenta de afiliado con ventas).
- Sé educado: el worker espera 3s entre peticiones. No bajes de ahí.

---

## Alojarlo GRATIS — dos caminos

### Opción A · VPS gratis para siempre (recomendada por simplicidad)

**Oracle Cloud Always Free** da una VM ARM gratis permanente. Un solo servidor
hace worker + API + SQLite.

```bash
# En la VM (Ubuntu): instala Node 24 (nvm o nodesource) y luego:
git clone TU_REPO && cd radar/backend && npm ci
npm run cron &          # rastreo en bucle (o un servicio systemd)
npm run start           # API en el puerto 3000
```

Abre el puerto 3000 en la lista de seguridad de Oracle.

### Opción B · Sin servidor

- **Rastreo → GitHub Actions.** El workflow `.github/workflows/scrape.yml` ya
  lanza `npm run scrape` cada 30 min y cachea la BD entre ejecuciones.
- **BD → [Turso](https://turso.tech)** (libSQL, mismo SQL) para que Action y API
  compartan datos. Sustituye `node:sqlite` por `@libsql/client`.
- **API → Render / Fly / Cloudflare Workers.** Hono corre en todos.

> **Recomendación:** empieza con la Opción A (Oracle) para validar los scrapers
> de una pieza; migra a la B si te cansa el VPS.
