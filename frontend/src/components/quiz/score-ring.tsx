import { cn } from "@/lib/utils";

export function ScoreRing({
  percent,
  passed,
  size = 128,
  pending = false,
  className,
}: {
  percent: number | null;
  passed?: boolean | null;
  size?: number;
  pending?: boolean;
  className?: string;
}) {
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const value = Math.max(0, Math.min(100, percent ?? 0));
  const color = pending ? "stroke-info" : passed === false ? "stroke-destructive" : passed ? "stroke-success" : "stroke-brand";
  return (
    <div className={cn("relative inline-grid place-items-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="fill-none stroke-muted" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (value / 100) * c}
          className={cn("fill-none transition-[stroke-dashoffset] duration-1000 ease-out", color)}
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-3xl font-semibold tracking-tight tabular-nums">{percent == null ? "–" : `${Math.round(value)}%`}</p>
        <p className="text-[11px] text-muted-foreground">{pending ? "provisional" : "score"}</p>
      </div>
    </div>
  );
}
