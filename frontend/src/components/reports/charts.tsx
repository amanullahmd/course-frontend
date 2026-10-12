"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";

/**
 * Lightweight, dependency-free charts built from HTML/CSS (bars) and SVG (ring). Colours come from the app tokens
 * (brand = primary series, info = secondary series) so light and dark mode both work, every chart has an
 * aria-label plus a visually hidden data table, and the bars print cleanly.
 */

export interface ColumnDatum {
  key: string;
  label: string;
  /** Long label for the tooltip / data table (defaults to label). */
  fullLabel?: string;
  values: number[];
}

export interface Series {
  name: string;
  /** Tailwind background class of the bars and the legend swatch. */
  className: string;
}

function niceMax(max: number): number {
  if (max <= 2) return 2;
  if (max <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(max));
  const steps = [1, 2, 4, 6, 8, 10]; // even steps keep the middle tick an integer
  for (const s of steps) {
    if (s * pow >= max) return s * pow;
  }
  return 10 * pow;
}

/** Visually hidden table with the chart data for screen readers (and a fallback when charts are not visible). */
export function ChartDataTable({
  caption,
  columns,
  rows,
  visible = false,
}: {
  caption: string;
  columns: string[];
  rows: (string | number)[][];
  visible?: boolean;
}) {
  // the sr-only wrapper (not the table itself) keeps wide tables from widening the page
  return (
    <div className={visible ? undefined : "sr-only"}>
      <table className={cn(visible && "mt-3 w-full text-sm")}>
        <caption
          className={cn(
            visible
              ? "mb-2 text-left text-xs text-muted-foreground"
              : undefined,
          )}
        >
          {caption}
        </caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c}
                scope="col"
                className="py-1 pr-3 text-left font-medium"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t">
              {r.map((v, j) =>
                j === 0 ? (
                  <th
                    key={j}
                    scope="row"
                    className="py-1 pr-3 text-left font-normal"
                  >
                    {v}
                  </th>
                ) : (
                  <td key={j} className="py-1 pr-3 tabular-nums">
                    {v}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Legend({ series }: { series: Series[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {series.map((s) => (
        <li key={s.name} className="flex items-center gap-1.5">
          <span
            className={cn("size-2.5 rounded-sm", s.className)}
            aria-hidden
          />
          {s.name}
        </li>
      ))}
    </ul>
  );
}

/**
 * Vertical column chart (one or more series side by side). Bars grow from the baseline with rounded tops,
 * a recessive grid with 3 ticks, labels under each group and a hover tooltip per bar.
 */
export function ColumnChart({
  data,
  series,
  ariaLabel,
  format = (n) => String(n),
  height = 180,
  labelEvery = 1,
}: {
  data: ColumnDatum[];
  series: Series[];
  ariaLabel: string;
  format?: (n: number) => string;
  height?: number;
  /** Show only every n-th x label (dense time axes). */
  labelEvery?: number;
}) {
  const max = niceMax(Math.max(0, ...data.flatMap((d) => d.values)));
  const ticks = [max, max / 2, 0];
  return (
    <figure className="chart min-w-0" aria-label={ariaLabel}>
      <div className="flex gap-2" aria-hidden>
        <div
          className="flex shrink-0 flex-col justify-between text-right text-[11px] text-muted-foreground tabular-nums"
          style={{ height }}
        >
          {ticks.map((t) => (
            <span
              key={t}
              className="-translate-y-1/2 leading-none first:translate-y-0 last:translate-y-0"
            >
              {format(Math.round(t * 10) / 10)}
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 flex flex-col justify-between"
            style={{ height }}
          >
            {ticks.map((t, i) => (
              <span
                key={t}
                className={cn(
                  "block border-t",
                  i === ticks.length - 1
                    ? "border-border"
                    : "border-dashed border-border/70",
                )}
              />
            ))}
          </div>
          <div
            className="relative flex items-end gap-[3px] sm:gap-1.5"
            style={{ height }}
          >
            {data.map((d) => (
              <div
                key={d.key}
                className="flex h-full min-w-0 flex-1 items-end justify-center gap-[2px]"
              >
                {d.values.map((v, si) => {
                  const h = max === 0 ? 0 : (v / max) * 100;
                  return (
                    <Tooltip
                      key={si}
                      content={
                        <span>
                          <span className="font-medium">
                            {d.fullLabel ?? d.label}
                          </span>
                          <br />
                          {series.length > 1 ? `${series[si].name}: ` : ""}
                          {format(v)}
                        </span>
                      }
                    >
                      <div
                        className="group flex h-full w-full max-w-12 cursor-default items-end"
                        tabIndex={-1}
                      >
                        <div
                          className={cn(
                            "chart-bar w-full rounded-t-[4px] transition-[height,opacity] duration-500 group-hover:opacity-80",
                            series[si].className,
                            v === 0 && "opacity-0",
                          )}
                          style={{ height: `${Math.max(h, v > 0 ? 2 : 0)}%` }}
                        />
                      </div>
                    </Tooltip>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex gap-[3px] sm:gap-1.5">
            {data.map((d, i) => (
              <span
                key={d.key}
                className="min-w-0 flex-1 truncate text-center text-[11px] text-muted-foreground tabular-nums"
              >
                {i % labelEvery === 0 ? d.label : ""}
              </span>
            ))}
          </div>
        </div>
      </div>
      <ChartDataTable
        caption={ariaLabel}
        columns={["", ...series.map((s) => s.name)]}
        rows={data.map((d) => [
          d.fullLabel ?? d.label,
          ...d.values.map(format),
        ])}
      />
    </figure>
  );
}

/** Horizontal meter: track + filled bar (0–100). */
export function Meter({
  value,
  className,
  barClassName = "bg-brand",
  label,
}: {
  value: number | null | undefined;
  className?: string;
  barClassName?: string;
  label?: string;
}) {
  const v = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v)}
      aria-label={label}
      className={cn(
        "meter h-2 w-full overflow-hidden rounded-full bg-muted",
        className,
      )}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500",
          barClassName,
        )}
        style={{ width: `${v}%` }}
      />
    </div>
  );
}

/** Circular progress (SVG), e.g. a learner's course completion. */
export function ProgressRing({
  value,
  size = 72,
  stroke = 7,
  label,
  display,
  className,
}: {
  value: number;
  size?: number;
  stroke?: number;
  label: string;
  /** Localized value text in the centre (defaults to "n%"). */
  display?: string;
  className?: string;
}) {
  const t = useTranslations("reports");
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn("relative grid shrink-0 place-items-center", className)}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={label}
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (v / 100) * c}
          className={cn(
            "transition-[stroke-dashoffset] duration-700",
            v >= 100 ? "stroke-success" : "stroke-brand",
          )}
        />
      </svg>
      <span className="absolute text-center leading-tight" aria-hidden>
        <span className="block text-base font-semibold tabular-nums">
          {display ?? `${Math.round(v)}%`}
        </span>
        <span className="block text-[10px] text-muted-foreground">
          {t("complete")}
        </span>
      </span>
    </div>
  );
}
