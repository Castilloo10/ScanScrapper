import type { Product } from "../types";
import { storeColor } from "../lib/stores";
import { priceDelta } from "../lib/filter";
import { Sparkline } from "./Sparkline";
import styles from "./ProductCard.module.css";

const EUR = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

function checkedLabel(updated: number): string {
  if (updated <= 0) return "hoy";
  if (updated === 1) return "ayer";
  return `hace ${updated} d`;
}

export function ProductCard({ product, isBest }: { product: Product; isBest: boolean }) {
  const c = storeColor(product.store);
  const delta = priceDelta(product.history);

  return (
    <article className={`${styles.card} ${isBest ? styles.best : ""}`}>
      <div className={styles.info}>
        <div className={styles.toprow}>
          <span className={styles.badge} style={{ background: c.bg, color: c.fg }}>
            {product.store}
          </span>
          <span className={`${styles.cond} ${product.cond === "nuevo" ? styles.nuevo : styles.usado}`}>
            {product.cond === "nuevo" ? "Nuevo" : "2ª mano"}
          </span>
          {isBest && <span className={styles.bestTag}>★ Mejor precio</span>}
        </div>
        <div className={styles.title} title={product.model}>{product.model}</div>
        <div className={styles.brandLine}>
          {product.brand} · comprobado {checkedLabel(product.updated)} ·{" "}
          {product.stock
            ? <span className={styles.stockYes}>en stock</span>
            : <span className={styles.stockNo}>sin stock</span>}
        </div>
      </div>

      <div className={styles.right}>
        <div className={styles.spark}>
          <Sparkline history={product.history} />
          <span className={`${styles.delta} ${styles[delta.cls]}`}>{delta.text}</span>
        </div>
        <div className={styles.price}>{EUR.format(product.price)}</div>
        <a
          className={styles.goto}
          href={product.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Ver oferta →
        </a>
      </div>
    </article>
  );
}
