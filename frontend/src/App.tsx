import { useEffect, useMemo, useState } from "react";
import type { Filters } from "./types";
import { DEFAULT_FILTERS } from "./types";
import { useCatalog } from "./hooks/useCatalog";
import { Header } from "./components/Header";
import { FilterPanel } from "./components/FilterPanel";
import { ResultsHead } from "./components/ResultsHead";
import { ProductCard } from "./components/ProductCard";
import { EmptyState } from "./components/EmptyState";
import { SkeletonGrid } from "./components/Skeleton";
import styles from "./App.module.css";

function agoLabel(updatedAt: number | null): string | null {
  if (!updatedAt) return null;
  const mins = Math.max(0, Math.floor(Date.now() / 1000 - updatedAt) / 60);
  if (mins < 1) return "hace un momento";
  if (mins < 60) return `hace ${Math.floor(mins)} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.floor(hours / 24)} d`;
}

export default function App() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [drawer, setDrawer] = useState(false);

  const { products, facets, updatedAt, loading, error, empty } = useCatalog(filters);

  const patch = (p: Partial<Filters>) => setFilters((f) => ({ ...f, ...p }));
  const clear = () => setFilters(DEFAULT_FILTERS);

  // Poda selecciones que ya no existen en las facetas (evita filtros fantasma
  // que fuerzan 0 resultados en silencio).
  useEffect(() => {
    const brandSet = new Set(facets.brands.map((b) => b.value));
    const storeSet = new Set(facets.stores.map((s) => s.value));
    if (brandSet.size === 0 && storeSet.size === 0) return;
    setFilters((f) => {
      const brands = f.brands.filter((b) => brandSet.has(b));
      const stores = f.stores.filter((s) => storeSet.has(s));
      if (brands.length === f.brands.length && stores.length === f.stores.length) return f;
      return { ...f, brands, stores };
    });
  }, [facets]);

  // Escape cierra el drawer en móvil.
  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawer(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer]);

  const best = useMemo(() => {
    const nuevos = products.filter((p) => p.cond === "nuevo");
    return nuevos.length ? Math.min(...nuevos.map((p) => p.price)) : null;
  }, [products]);

  const ago = agoLabel(updatedAt);
  const showSkeleton = loading && products.length === 0;

  return (
    <>
      <Header
        query={filters.q}
        onSearch={(q) => patch({ q })}
        onToggleFilters={() => setDrawer((d) => !d)}
        filtersOpen={drawer}
      />

      <main className={styles.shell}>
        {error ? (
          <div className={`${styles.notice} ${styles.noticeError}`}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v5M12 16.5v.5" />
            </svg>
            <div>
              <b>No se pudo cargar el catálogo.</b> {error} Vuelve a intentarlo en un momento.
            </div>
          </div>
        ) : ago ? (
          <div className={styles.updated}>
            Precios actualizados <b>{ago}</b>.
          </div>
        ) : null}

        <FilterPanel
          filters={filters}
          patch={patch}
          brands={facets.brands}
          stores={facets.stores}
          onClear={clear}
          open={drawer}
          onClose={() => setDrawer(false)}
        />

        <section>
          <ResultsHead
            count={products.length}
            term={filters.q}
            sort={filters.sort}
            onSort={(sort) => patch({ sort })}
            loading={loading}
          />
          <div className={styles.grid} aria-busy={loading}>
            {showSkeleton ? (
              <SkeletonGrid count={6} />
            ) : products.length === 0 ? (
              <EmptyState variant={empty ? "no-data" : "no-match"} />
            ) : (
              products.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  isBest={p.price === best && p.cond === "nuevo"}
                />
              ))
            )}
          </div>
        </section>
      </main>
    </>
  );
}
