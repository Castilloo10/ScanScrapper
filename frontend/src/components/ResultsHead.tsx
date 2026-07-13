import type { SortKey } from "../types";
import styles from "./ResultsHead.module.css";

interface Props {
  count: number;
  term: string;
  sort: SortKey;
  onSort: (s: SortKey) => void;
  loading?: boolean;
}

const SORTS: { value: SortKey; label: string }[] = [
  { value: "price-asc", label: "Precio ↑" },
  { value: "price-desc", label: "Precio ↓" },
  { value: "drop", label: "Mayor bajada" },
  { value: "recent", label: "Más reciente" },
];

export function ResultsHead({ count, term, sort, onSort, loading }: Props) {
  return (
    <div className={styles.head}>
      <div className={styles.count} role="status" aria-live="polite">
        {loading ? (
          <span>Buscando…</span>
        ) : (
          <>
            <b>{count}</b> resultados
            {term && <> para <span className={styles.term}>"{term}"</span></>}
          </>
        )}
      </div>
      <div className={styles.sortwrap}>
        <label htmlFor="sort">Ordenar</label>
        <select id="sort" value={sort} onChange={(e) => onSort(e.target.value as SortKey)}>
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
