import styles from "./EmptyState.module.css";

/** "no-match": hay datos pero ningún filtro coincide. "no-data": catálogo vacío. */
export function EmptyState({ variant = "no-match" }: { variant?: "no-match" | "no-data" }) {
  const noData = variant === "no-data";
  return (
    <div className={styles.empty}>
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#626c85" strokeWidth={1.5} aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.3-4.3" />
      </svg>
      <h3>{noData ? "Todavía no hay datos" : "Sin coincidencias"}</h3>
      <p>
        {noData
          ? "El rastreador aún no ha registrado ofertas. Vuelve en unos minutos."
          : "Prueba a ampliar el rango de precio o quitar algún filtro."}
      </p>
    </div>
  );
}
