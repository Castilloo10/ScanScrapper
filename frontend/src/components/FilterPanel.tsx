import type { Condition, Filters } from "../types";
import type { Facet } from "../lib/stores";
import styles from "./FilterPanel.module.css";

const Check = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0e1220" strokeWidth={3.5} aria-hidden="true">
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

interface Props {
  filters: Filters;
  patch: (p: Partial<Filters>) => void;
  brands: Facet[];
  stores: Facet[];
  onClear: () => void;
  open: boolean;
  onClose: () => void;
}

const CONDS: { value: Condition | "todos"; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "nuevo", label: "Nuevo" },
  { value: "usado", label: "2ª mano" },
];

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function FilterPanel({ filters, patch, brands, stores, onClear, open, onClose }: Props) {
  return (
    <>
      <div className={`${styles.scrim} ${open ? styles.open : ""}`} onClick={onClose} aria-hidden="true" />
      <aside
        id="filtros"
        className={`${styles.aside} ${open ? styles.open : ""}`}
        aria-label="Filtros"
      >
        <div className={styles.drawerHead}>
          <span>Filtros</span>
          <button className={styles.close} onClick={onClose} aria-label="Cerrar filtros">✕</button>
        </div>

        <div className={styles.group}>
          <h4>Precio (€)</h4>
          <div className={styles.priceInputs}>
            <input
              type="number" placeholder="mín" min={0} inputMode="numeric" aria-label="Precio mínimo"
              value={filters.priceMin ?? ""}
              onChange={(e) => patch({ priceMin: e.target.value ? Number(e.target.value) : null })}
            />
            <span className={styles.dash}>—</span>
            <input
              type="number" placeholder="máx" min={0} inputMode="numeric" aria-label="Precio máximo"
              value={filters.priceMax ?? ""}
              onChange={(e) => patch({ priceMax: e.target.value ? Number(e.target.value) : null })}
            />
          </div>
        </div>

        <div className={styles.group}>
          <h4 id="estado-label">Estado</h4>
          <div className={styles.seg} role="radiogroup" aria-labelledby="estado-label">
            {CONDS.map((c) => (
              <button
                key={c.value}
                role="radio"
                aria-checked={filters.cond === c.value}
                className={filters.cond === c.value ? styles.on : ""}
                onClick={() => patch({ cond: c.value })}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.group}>
          <h4>Marca</h4>
          {brands.length === 0 && <p className={styles.muted}>—</p>}
          {brands.map((b) => (
            <label className={styles.check} key={b.value}>
              <input
                type="checkbox"
                checked={filters.brands.includes(b.value)}
                onChange={() => patch({ brands: toggle(filters.brands, b.value) })}
              />
              <span className={styles.box}><Check /></span>
              {b.value}
              <span className={styles.cnt}>{b.count}</span>
            </label>
          ))}
        </div>

        <div className={styles.group}>
          <h4>Tienda</h4>
          {stores.length === 0 && <p className={styles.muted}>—</p>}
          {stores.map((s) => (
            <label className={styles.check} key={s.value}>
              <input
                type="checkbox"
                checked={filters.stores.includes(s.value)}
                onChange={() => patch({ stores: toggle(filters.stores, s.value) })}
              />
              <span className={styles.box}><Check /></span>
              {s.value}
              <span className={styles.cnt}>{s.count}</span>
            </label>
          ))}
        </div>

        <div className={styles.group}>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={filters.stockOnly}
              onChange={(e) => patch({ stockOnly: e.target.checked })}
            />
            <span className={styles.box}><Check /></span>
            Solo en stock
          </label>
        </div>

        <button className={styles.clear} onClick={onClear}>Limpiar filtros</button>
      </aside>
    </>
  );
}
