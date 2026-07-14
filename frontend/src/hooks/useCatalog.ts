import { useEffect, useMemo, useState } from "react";
import type { Filters, Product } from "../types";
import { filterProducts } from "../lib/filter";
import { facets as deriveFacets } from "../lib/stores";
import {
  MODE, fetchSnapshot, fetchQuery,
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
  /** modo búsqueda-en-vivo sin término escrito todavía → pide buscar. */
  awaitingQuery: boolean;
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
    awaitingQuery: false,
    mode: "static",
  };
}

/**
 * Búsqueda en vivo: rastrea el término al vuelo cuando cambia (no en cada
 * filtro) y filtra precio/marca/tienda/orden en cliente sobre lo devuelto.
 */
function useLiveCatalog(filters: Filters): Catalog {
  const [dataset, setDataset] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [searched, setSearched] = useState(false);

  const q = filters.q.trim();

  useEffect(() => {
    if (!q) { setDataset([]); setSearched(false); setError(undefined); setLoading(false); return; }
    const ac = new AbortController();
    setLoading(true);
    setError(undefined);
    fetchQuery(q, ac.signal)
      .then((products) => {
        if (ac.signal.aborted) return;
        setDataset(products); setSearched(true); setLoading(false);
      })
      .catch((e) => {
        if (ac.signal.aborted || (e as Error).name === "AbortError") return;
        setDataset([]); setError((e as Error).message); setLoading(false);
      });
    return () => ac.abort();
  }, [q]);

  const products = useMemo(() => filterProducts(dataset, filters), [dataset, filters]);
  const facets = useMemo<FacetSet>(() => {
    const f = deriveFacets(dataset);
    return { brands: f.brands, stores: f.stores };
  }, [dataset]);

  return {
    products,
    facets,
    updatedAt: null,
    loading,
    error,
    empty: searched && dataset.length === 0 && !loading && !error,
    awaitingQuery: !q && !loading,
    mode: "api",
  };
}

/**
 * MODE es una constante de módulo (no cambia en runtime), así que elegir el
 * hook por modo mantiene un orden de hooks estable entre renders.
 */
export const useCatalog =
  MODE === "static" ? useStaticCatalog : useLiveCatalog;
