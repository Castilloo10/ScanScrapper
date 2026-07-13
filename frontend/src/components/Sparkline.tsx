import { sparkline } from "../lib/filter";

export function Sparkline({ history }: { history: number[] }) {
  const { points, color, w, h, flat } = sparkline(history);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" aria-hidden="true">
      <polyline
        points={points}
        stroke={color}
        strokeWidth={1.6}
        strokeLinejoin="round"
        strokeLinecap="round"
        // Con un solo dato la línea es plana: la marcamos para distinguir
        // "sin histórico" de una tendencia real.
        strokeDasharray={flat ? "2 3" : undefined}
        opacity={flat ? 0.5 : 1}
      />
    </svg>
  );
}
