import { useEffect, useRef, useState } from "react";
import styles from "./Header.module.css";

interface Props {
  query: string;                 // valor actual de filters.q (fuente de verdad)
  onSearch: (q: string) => void;
  onToggleFilters: () => void;
  filtersOpen: boolean;
}

export function Header({ query, onSearch, onToggleFilters, filtersOpen }: Props) {
  const [value, setValue] = useState(query);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Si el estado externo cambia (p. ej. "Limpiar filtros" pone q=""), refleja
  // ese cambio en el input. Así el input y el estado nunca quedan desincronizados.
  useEffect(() => {
    setValue(query);
  }, [query]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const handle = (v: string) => {
    setValue(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onSearch(v.trim()), 300);
  };

  return (
    <header className={styles.header}>
      <div className={styles.bar}>
        <div className={styles.brand}>
          <div className={styles.mark}>
            <div className={styles.ping} />
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="3" fill="#f5b23d" />
              <circle cx="12" cy="12" r="7" stroke="#3dd6c4" strokeWidth={1.4} opacity={0.55} />
              <circle cx="12" cy="12" r="10.5" stroke="#3dd6c4" strokeWidth={1.2} opacity={0.25} />
            </svg>
          </div>
          <div>
            <div className={styles.name}>RA<span>DAR</span></div>
            <div className={styles.sub}>Precios · España</div>
          </div>
        </div>

        <div className={styles.searchwrap}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            type="search"
            aria-label="Buscar producto"
            placeholder="Busca un producto…  p.ej. RTX 5070 Ti"
            autoComplete="off"
            value={value}
            onChange={(e) => handle(e.target.value)}
          />
        </div>

        <button
          className={styles.toggle}
          onClick={onToggleFilters}
          aria-label="Filtros"
          aria-expanded={filtersOpen}
          aria-controls="filtros"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path d="M4 6h16M7 12h10M10 18h4" />
          </svg>
          Filtros
        </button>
      </div>
    </header>
  );
}
