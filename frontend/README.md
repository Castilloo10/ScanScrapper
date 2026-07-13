# RADAR · frontend

Buscador de precios/stock con filtros. **React + Vite + TypeScript**, componentes
separados y CSS Modules. Funciona con datos de ejemplo desde el primer momento y
pasa a datos reales en cuanto apuntas a tu backend.

## Arrancar

```bash
npm install
npm run dev        # http://localhost:5173
```

Build de producción (carpeta estática en `dist/`):

```bash
npm run build
npm run preview
```

## Conectar al backend

Copia `.env.example` a `.env` y pon la URL de tu API:

```
VITE_API_URL=http://localhost:3000
```

Con eso, `src/api.ts` llama a `GET /search` con los filtros. Sin la variable,
usa los datos de ejemplo de `src/mockData.ts` (filtrado en cliente). El aviso
amarillo de "datos de ejemplo" desaparece solo cuando la API está configurada.

## Estructura

```
src/
  types.ts                 → tipos compartidos (mismo shape que la API)
  api.ts                   → fetch al backend + fallback a datos de ejemplo
  mockData.ts              → datos de ejemplo
  hooks/useProducts.ts     → carga de datos según los filtros
  lib/
    filter.ts              → filtrado/orden en cliente + helpers del sparkline
    stores.ts              → colores de tienda + conteo de facetas
  components/
    Header.tsx             → logo + buscador (con debounce)
    FilterPanel.tsx        → precio, estado, marca, tienda, stock
    ResultsHead.tsx        → contador + orden
    ProductCard.tsx        → tarjeta con precio, mini-histórico y mejor precio
    Sparkline.tsx          → gráfico de histórico
    EmptyState.tsx         → estado sin resultados
```

Cada componente lleva su `.module.css`. Los tokens de color/tema están en
`src/styles/index.css`.

## Notas

- Las marcas y tiendas de los filtros se derivan de `mockData.ts`. Con backend
  real, expón un endpoint `/facets` (o añádelas al `/search`) y sustituye la
  constante `FACETS` de `App.tsx`.
- Verificado con `npm run build` (tsc en modo estricto + Vite) sin errores.
