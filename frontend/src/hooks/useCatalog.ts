import { useEffect, useMemo, useState } from "react";
import type { Filters, Product } from "../types";
import { filterProducts } from "../lib/filter";
import {
  MODE, fetchSnapshot, fetchProductsApi, fetchFacetsApi,
  type FacetSet, type Snapshot,
} from "../data";

export interface Catalog {
  products: Product[];
  facets: FacetSet;
  updatedAt: number | null;
  loading: boolean;
  error?: string;
  /** true cuando el catálogo cargó pero está vacío (aún no hay datos). */
  empty: boolean;
  mode: "api" | "static";
}

const EMPTY_FACETS: FacetSet = { brands: [], stores: [] };

// El snapshot estático se carga una sola vez y se comparte entre renders/hooks.
let snapshotPromise: Promise<Snapshot> | null = null;
function loadSnapshotOnce(): Promise<Snapshot> {
  if (!snapshotPromise) snapshotPromise = fetchSnapshot();
  return snapshotPromise;
}

function useStaticCatalog(filters: Filters): Catalog {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    let alive = true;
    loadSnapshotOnce()
      .then((s) => { if (alive) setSnap(s); })
      .catch((e) => {
        snapshotPromise = null; // permite reintentar en el próximo montaje
        if (alive) setError((e as Error).message);
      });
    return () => { alive = false; };
  }, []);

  // Filtrado y orden en cliente sobre el snapshot completo.
  const products = useMemo(
    () => (snap ? filterProducts(snap.products, filters) : []),
    [snap, filters],
  );

  return {
    products,
    facets: snap?.facets ?? EMPTY_FACETS,
    updatedAt: snap?.updatedAt ?? null,
    loading: !snap && !error,
    error,
    empty: !!snap && snap.products.length === 0,
    mode: "static",
  };
}

function useApiCatalog(filters: Filters): Catalog {
  const [state, setState] = useState<{ products: Product[]; loading: boolean; error?: string }>({
    products: [], loading: true,
  });
  const [facets, setFacets] = useState<FacetSet>(EMPTY_FACETS);

  useEffect(() => {
    const ac = new AbortController();
    setState((s) => ({ ...s, loading: true }));
    fetchProductsApi(filters, ac.signal)
      .then((products) => { if (!ac.signal.aborted) setState({ products, loading: false }); })
      .catch((e) => {
        if (ac.signal.aborted || (e as Error).name === "AbortError") return;
        setState({ products: [], loading: false, error: (e as Error).message });
      });
    return () => ac.abort();
  }, [filters]);

  useEffect(() => {
    const ac = new AbortController();
    fetchFacetsApi(ac.signal)
      .then((f) => { if (!ac.signal.aborted) setFacets(f); })
      .catch(() => { /* facetas son opcionales para pintar filtros */ });
    return () => ac.abort();
  }, []);

  return {
    products: state.products,
    facets,
    updatedAt: null,
    loading: state.loading,
    error: state.error,
    empty: !state.loading && !state.error && state.products.length === 0,
    mode: "api",
  };
}

/**
 * MODE es una constante de módulo (no cambia en runtime), así que elegir el
 * hook por modo mantiene un orden de hooks estable entre renders.
 */
export const useCatalog =
  MODE === "static" ? useStaticCatalog : useApiCatalog;
