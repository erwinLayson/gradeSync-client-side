import type { ReactNode } from "react";

import { SkeletonLine } from "./Skeleton";

/** Visual tone of the trend chip; maps to `analytics__trend--*` variants. */
export type KpiTrend = "up" | "down" | "flat" | "live";

interface KpiCardProps {
  /** Small uppercase label, e.g. "Total Students". */
  label: string;
  /** The stat value; a string so pages can render "—" or "No data found". */
  value: ReactNode;
  /** Chip under the value. Omit for a bare label/value card (developer dashboard). */
  trend?: { tone: KpiTrend; text: ReactNode };
  /** Tailwind icon component; rendered inside the tinted 44px square. */
  icon: React.ComponentType;
  /** While true, the value (and trend) render as skeleton pills. */
  loading?: boolean;
  /** Accent icon treatment, e.g. the warning-tinted attendance icon. */
  iconAccent?: boolean;
  className?: string;
}

/**
 * Shared KPI stat card — the icon + label + big value + trend-chip block
 * duplicated across AdminDashboard, Analytics-Reports, and DeveloperDashboard.
 */
export function KpiCard({
  label,
  value,
  trend,
  icon: Icon,
  loading = false,
  iconAccent = false,
  className,
}: KpiCardProps) {
  return (
    <div className={`analytics__kpi flex items-center gap-4 p-4${className ? ` ${className}` : ""}`}>
      {loading ? (
        <SkeletonLine width="2.75rem" height="2.75rem" radius="0.75rem" />
      ) : (
        <span
          className={`analytics__kpi-icon${iconAccent ? " analytics__kpi-icon--accent" : ""} inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg`}
          aria-hidden="true"
        >
          <Icon />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <span className="analytics__kpi-label block text-[0.6875rem] font-bold uppercase tracking-[0.08em]">
          {label}
        </span>
        {loading ? (
          <SkeletonLine width="4.5rem" height="1.75rem" radius="0.5rem" className="mt-1.5" />
        ) : (
          <span className="analytics__kpi-value mt-0.5 block text-[1.5rem] font-bold leading-none">
            {value}
          </span>
        )}
        {trend !== undefined &&
          (loading ? (
            /* Skeleton pill that matches the trend chip size. */
            <SkeletonLine width="3.5rem" height="1rem" radius="9999px" className="mt-1.5" />
          ) : (
            <span
              className={`analytics__trend analytics__trend--${trend.tone} mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 text-[0.6875rem]`}
            >
              {trend.text}
            </span>
          ))}
      </div>
    </div>
  );
}
