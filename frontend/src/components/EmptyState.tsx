import styles from "./EmptyState.module.css";

type Variant = "no-match" | "no-data" | "search";

/** "search": modo en vivo sin término. "no-match": hay datos, ningún filtro
 *  coincide. "no-data": catálogo vacío. */
export function EmptyState({ variant = "no-match" }: { variant?: Variant }) {
  const title =
    variant === "search" ? "Busca cualquier producto"
    : variant === "no-data" ? "Todavía no hay datos"
    : "Sin coincidencias";
  const text =
    variant === "search"
      ? "Escribe un producto arriba (p. ej. «RTX 5070», «SSD 2TB», «monitor 240Hz») y buscaré el precio en todas las tiendas."
      : variant === "no-data"
        ? "El rastreador aún no ha registrado ofertas. Vuelve en unos minutos."
        : "Prueba a ampliar el rango de precio o quitar algún filtro.";
  return (
    <div className={styles.empty}>
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#626c85" strokeWidth={1.5} aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.3-4.3" />
      </svg>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
