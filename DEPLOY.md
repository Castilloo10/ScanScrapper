# Desplegar RADAR — 100% gratis, 24/7

**Sí se puede tener funcionando siempre y gratis del todo.** La clave: **no hay
servidor encendido**. Los "free tier" de APIs (Render, Fly…) se duermen o
caducan; aquí lo evitamos.

## Cómo funciona (arquitectura sin servidor)

```
GitHub Actions (cada 3 h)                     GitHub Pages (estático, 24/7)
┌───────────────────────────┐                 ┌──────────────────────────┐
│ 1. restaura la BD (caché)  │                 │  index.html + JS + CSS   │
│ 2. rastrea las tiendas     │   products.json │  products.json (snapshot)│
│ 3. genera products.json    │  ─────────────► │                          │
│ 4. build del frontend      │    (en el build)│  el navegador lo carga y │
│ 5. publica en Pages        │                 │  filtra/ordena en cliente│
│ 6. guarda la BD (caché)    │                 └──────────────────────────┘
└───────────────────────────┘
```

- El **rastreador** corre en GitHub Actions (cron). No necesita estar "vivo".
- El **histórico de precios** se conserva cacheando el fichero SQLite entre
  ejecuciones (así el sparkline se va llenando con el tiempo).
- El **frontend** es estático: no llama a ninguna API en producción, lee un
  `products.json` que ya viene en el sitio y filtra en el navegador
  (`lib/filter.ts`). Cero backend encendido, cero base de datos de pago.

## Por qué es gratis de verdad

| Pieza | Servicio | Coste |
|---|---|---|
| Rastreo programado | GitHub Actions | Gratis (ilimitado en repos **públicos**) |
| Hosting web 24/7 | GitHub Pages | Gratis |
| Base de datos | SQLite en la caché de Actions | Gratis |
| **Total** | | **0 €** |

Con cadencia de **3 horas** cabe incluso en el tope de repos privados (2000
min/mes). En repos públicos los minutos son ilimitados.

## Pasos (una vez)

1. **Crea un repositorio en GitHub** (recomendado: **público**, para minutos
   ilimitados) y sube el proyecto:
   ```bash
   cd e:/Descargas/radar
   git init
   git add .
   git commit -m "RADAR"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/radar.git
   git push -u origin main
   ```
2. En GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. En **Settings → Actions → General**, permite que los workflows tengan permisos
   de escritura si hiciera falta (normalmente ya vale con los `permissions` del
   workflow).
4. Lanza el primer despliegue: pestaña **Actions → deploy → Run workflow**
   (o simplemente espera al cron / haz un push).
5. Tu web queda en `https://TU_USUARIO.github.io/radar/`.

El workflow ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)) hace
todo: rastrear, generar el snapshot, construir y publicar. Se repite cada 3 h.

> **Nota sobre `BASE_PATH`:** el workflow usa `/nombre-del-repo/` automáticamente.
> Si usas un dominio propio o un repo `TU_USUARIO.github.io`, la base es `/` (edita
> el `env: BASE_PATH` del workflow).

## Desarrollo local

```bash
# Genera un snapshot real y míralo en el frontend estático:
cd backend  && npm ci && npm run snapshot     # rastrea + escribe products.json
cd frontend && npm ci && npm run dev          # http://localhost:5173

# O con backend en vivo (modo API): crea frontend/.env con
#   VITE_API_URL=http://localhost:3000
# y en otra terminal: cd backend && npm run dev
```

## Aviso honesto sobre el rastreo en la nube

Las IP de los runners de GitHub son de centro de datos y algunas tiendas
(Cloudflare Bot Management) las bloquean más que a una IP doméstica:

- **Alternate.es** suele responder → datos reales en la nube.
- **PCComponentes** devuelve **403** (bloqueo fuerte): necesitaría un navegador
  headless o su API. Está configurada pero no rinde desde CI.
- Si un rastreo sale vacío, la web muestra "Todavía no hay datos" (nunca precios
  inventados) y el histórico **no** se corrompe.

Si quieres máxima fiabilidad de datos, puedes correr el rastreo desde una
máquina propia (o un VPS gratis como Oracle Always Free) y subir el
`products.json`, o usar el **modo API** apuntando `VITE_DATA_URL` a un snapshot
alojado aparte. Ver [backend/README.md](backend/README.md).

## Desbloquear las tiendas que dan 403 en la nube (opcional, gratis)

Algunas tiendas (PCComponentes, Dynos, Neobyte) devuelven **403 por reputación
de IP de datacenter**: el mismo rastreo funciona desde una IP residencial pero
no desde los runners de GitHub. En el código van marcadas `proxied: true`
([backend/src/sources/stores.ts](backend/src/sources/stores.ts)); en local se
rastrean directas y gratis, y en la nube puedes darles una IP limpia con una de
estas opciones (elige UNA):

**Opción 1 · API de scraping con free tier (fiable).**
[ScrapingAnt](https://scrapingant.com) da 10.000 créditos/mes gratis sin tarjeta.
Regístrate, copia tu API key y añade en el repo un **secreto** (Settings →
Secrets and variables → Actions → *Secrets*) llamado `SCRAPER_PROXY` con:
```
https://api.scrapingant.com/v2/general?url={url}&x-api-key=TU_KEY&browser=false&proxy_type=residential&proxy_country=ES
```
El `{url}` lo rellena el backend. Da para ~1-2 pasadas al día de esas 3 tiendas
(reduce la frecuencia del cron a cada 12 h para no agotar créditos). Alternativas
con free tier: Scrape.do (1.000/mes), ScraperAPI (1.000/mes).

**Opción 2 · Cloudflare WARP (sin registro, IP de Cloudflare).**
Pon la **variable** de repo (Settings → … → *Variables*) `USE_WARP` = `true`.
El workflow instala WARP y enruta esas 3 tiendas por una IP de Cloudflare (no
datacenter). Gratis y sin cuenta, pero la fiabilidad varía por tienda (algunas
también bloquean rangos WARP). Pruébalo: si no mejora, usa la Opción 1.

**Opción 3 · Rastrear desde tu casa (lo más fiable).**
Tu IP residencial ya devuelve 200 en las 3. Opciones: (a) tarea programada en tu
PC que hace `npm run snapshot` + `git push`; (b) un *self-hosted runner* de
GitHub en tu PC (solo en repos privados por seguridad). Necesita el PC encendido.

## ¿Y Amazon.es?

**No hay una vía fiable y gratis.** La API oficial (PA-API 5.0) se apagó en mayo
2026; su sustituta (Creators API) exige ser afiliado con **10 ventas/mes**,
inviable para un hobby. El scraping directo de Amazon da captcha/503 (peor aún
desde datacenter) y su HTML no trae `ld+json` de precio fiable. Las opciones con
datos buenos son de pago: **Keepa** (49 €/mes, incluye histórico), **ScraperAPI**
(~19 $/mes). Free tier de verdad: **Canopy** (100 peticiones/mes). Recomendación:
dejar Amazon fuera salvo que asumas un coste mensual.

## Alternativa: Cloudflare Pages

Cloudflare Pages también es gratis y sirve en `/` (sin subruta):
- Conecta el repo, build command:
  `cd backend && npm ci && npm run snapshot && cd ../frontend && npm ci && npm run build`
- Output directory: `frontend/dist`
- Inconveniente: no cachea el SQLite entre builds, así que el histórico no se
  acumula igual de bien que con GitHub Actions. Por eso recomendamos Pages+Actions.
