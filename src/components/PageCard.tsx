import type { ReactNode } from "react";

/** Element to render the card as; defaults to div. */
type PageCardElement = "div" | "section" | "form" | "article";

interface PageCardProps {
  children: ReactNode;
  /** Visual variant. "flat" adds the neutral border used by detail/panel cards. */
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
 * Shared page card shell — the `overflow-hidden rounded-2xl bg-white shadow-sm`
 * banner repeated on every page. Purely presentational; header/hero content
 * stays the consumer's responsibility. Page-specific BEM classes go in
 * `className` (e.g. `analytics__card`, `settings__card`).
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
  const classes = `overflow-hidden rounded-2xl bg-white shadow-sm${
    variant === "flat" ? " border" : ""
  }${className ? ` ${className}` : ""}`;

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
