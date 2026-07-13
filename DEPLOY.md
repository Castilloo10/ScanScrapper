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

## Alternativa: Cloudflare Pages

Cloudflare Pages también es gratis y sirve en `/` (sin subruta):
- Conecta el repo, build command:
  `cd backend && npm ci && npm run snapshot && cd ../frontend && npm ci && npm run build`
- Output directory: `frontend/dist`
- Inconveniente: no cachea el SQLite entre builds, así que el histórico no se
  acumula igual de bien que con GitHub Actions. Por eso recomendamos Pages+Actions.
