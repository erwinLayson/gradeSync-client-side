import type { ReactNode } from "react";

/** Element to render the card as; defaults to div. */
type PageCardElement = "div" | "section" | "form" | "article";

interface PageCardProps {
  children: ReactNode;
  /** Kept for callers; both variants render the same flat hairline card. */
  variant?: "default" | "flat";
  /** Optional page-specific extra classes (BEM hook, padding, layout). */
  className?: string;
  /** Accessible name, e.g. for loading skeletons announced to screen readers. */
  ariaLabel?: string;
  /** Set while the card content is loading (renders skeleton states). */
  ariaBusy?: boolean;
  /** Element to render the card as. Use "form" when the card wraps a form. */
  as?: PageCardElement;
  /** Form props, only used when as="form". */
  onSubmit?: React.FormEventHandler;
}

/**
 * Shared page card shell — a flat white surface with a single hairline
 * border, no shadow or gradient. Purely presentational; header content stays
 * the consumer's responsibility. Page-specific BEM classes go in `className`
 * (e.g. `analytics__card`, `settings__card`). New pages should prefer
 * `PageSection` from `./PageLayout`; this primitive remains for the existing
 * per-page card markup.
 */
export function PageCard({
  children,
  variant = "default",
  className,
  ariaLabel,
  ariaBusy,
  as = "div",
  onSubmit,
}: PageCardProps) {
  // Both variants share one flat treatment; `variant` is retained so existing
  // callers keep compiling.
  void variant;
  const classes = `overflow-hidden rounded-2xl border border-[var(--neutral-border)] bg-white${
    className ? ` ${className}` : ""
  }`;

  if (as === "form") {
    return (
      <form className={classes} aria-label={ariaLabel} aria-busy={ariaBusy} onSubmit={onSubmit}>
        {children}
      </form>
    );
  }

  const Element = as;
  return (
    <Element className={classes} aria-label={ariaLabel} aria-busy={ariaBusy}>
      {children}
    </Element>
  );
}
