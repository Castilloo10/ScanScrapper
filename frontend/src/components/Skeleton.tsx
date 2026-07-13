import styles from "./Skeleton.module.css";

/** Tarjeta fantasma mientras cargan los resultados. */
export function SkeletonCard() {
  return (
    <div className={styles.card} aria-hidden="true">
      <div className={styles.left}>
        <div className={`${styles.line} ${styles.badge}`} />
        <div className={`${styles.line} ${styles.title}`} />
        <div className={`${styles.line} ${styles.sub}`} />
      </div>
      <div className={styles.right}>
        <div className={`${styles.line} ${styles.spark}`} />
        <div className={`${styles.line} ${styles.price}`} />
      </div>
    </div>
  );
}

export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => <SkeletonCard key={i} />)}
    </>
  );
}
