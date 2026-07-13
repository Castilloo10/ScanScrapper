# RADAR

Rastreador de precios/stock para tiendas españolas (GPUs, hardware…).
Monorepo con dos módulos que encajan por el mismo contrato de datos:

```
radar/
  frontend/          → React + Vite + TypeScript (buscador + filtros)
  backend/           → Node 24 + TypeScript + Hono (scrapers + API + SQLite)
  radar.code-workspace
```

## Abrir en VS Code

Abre el fichero **`radar.code-workspace`** (File → Open Workspace from File…).
Verás las dos carpetas como raíces separadas. VS Code te ofrecerá instalar las
extensiones recomendadas (Bun, Prettier, ESLint); acéptalas.

## Requisitos

- **Node.js 24+** para todo el monorepo (el backend usa `node:sqlite`
  integrado; no hace falta Bun). Comprueba con `node -v`.

## Arrancar (dos terminales)

**1 · Backend**
```bash
cd backend
npm install
npm run scrape     # llena la base de datos (primera pasada)
npm run dev        # API en http://localhost:3000
```

**2 · Frontend**
```bash
cd frontend
npm install
npm run dev               # http://localhost:5173
```

Por defecto el frontend funciona en **modo estático**: carga `products.json`
(el snapshot que genera `npm run snapshot` en el backend) y filtra en el
navegador. No hay datos de ejemplo: si no hay snapshot, muestra "Todavía no hay
datos" en vez de precios inventados. Para usar el backend en vivo, crea
`frontend/.env` con `VITE_API_URL=http://localhost:3000`.

## Cómo encajan

El backend expone `GET /search` con filtros (precio, marca, tienda, estado,
stock, orden) y devuelve un array con este shape, que es exactamente lo que
consume el frontend:

```ts
{ id, model, brand, store, cond, price, stock, updated, history, url }
```

También expone `GET /facets`, que da el vocabulario real de marcas y tiendas
(con recuentos) para que el frontend pinte los filtros sin inventárselos.

Cada módulo tiene su propio README con más detalle:
- `frontend/README.md` → estructura de componentes y variables de entorno.
- `backend/README.md` → scrapers, base de datos y **cómo alojarlo gratis**
  (Oracle Always Free o GitHub Actions + Turso).

## Desplegar gratis 24/7

Se puede tener online siempre y **100% gratis**, sin servidor encendido:
GitHub Actions rastrea cada 3 h y publica un snapshot estático en GitHub Pages.
Pasos completos en **[DEPLOY.md](DEPLOY.md)**.

## Estado

- Backend portado a **Node 24** (`node:sqlite` + `@hono/node-server`), sin Bun.
- Scrapers unificados en un **motor genérico** (JSON-LD → microdata → CSS) con
  catálogo declarativo en `backend/src/sources/stores.ts`. Activas:
  PCComponentes, Alternate, VS Gamers. En cola (vía sitemap): MediaMarkt, Dynos,
  Neobyte.
- Los selectores se validaron contra el HTML real (recon julio 2026); si una
  tienda cambia y devuelve 0 ofertas, el worker lo avisa sin corromper datos.
