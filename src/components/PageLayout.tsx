import type { ReactNode } from "react";

/* ============================================================
   Minimal page structure
   The one frame every authenticated page builds from. Replaces the
   per-page gradient heroes, eyebrow/chip decoration and repeated
   `overflow-hidden rounded-2xl bg-white shadow-sm` card markup.

     <PageShell>
       <PageHeader title="Students" description="…" meta="SY 2025–2026" />
       <PageSection title="All students" actions={<button …/>}>…</PageSection>
     </PageShell>
   ============================================================ */

/* ---------- PageShell ---------- */

interface PageShellProps {
  children: ReactNode;
  /** Extra classes for page-specific layout (grid, padding). */
  className?: string;
  /** Set while the page's data is loading. */
  busy?: boolean;
  /** Accessible name for loading/announcement contexts. */
  label?: string;
}

/** The page frame: a vertical stack with one consistent gap. */
export function PageShell({ children, className, busy, label }: PageShellProps) {
  return (
    <div className={`page${className ? ` ${className}` : ""}`} aria-busy={busy} aria-label={label}>
      {children}
    </div>
  );
}

/* ---------- PageHeader ---------- */

interface PageHeaderProps {
  /** Page title, e.g. "Students". */
  title: ReactNode;
  /** One line of supporting text under the title. */
  description?: ReactNode;
  /** Small right-aligned context text, e.g. "SY 2025–2026 · Q2". */
  meta?: ReactNode;
  /** Right-aligned action(s), typically buttons. */
  actions?: ReactNode;
  className?: string;
}

/** Flat page header — plain typography on the page background, no card. */
export function PageHeader({ title, description, meta, actions, className }: PageHeaderProps) {
  return (
    <header className={`page__header${className ? ` ${className}` : ""}`}>
      <div className="page__header-text">
        <h2 className="page__title">{title}</h2>
        {description != null && <p className="page__description">{description}</p>}
      </div>
      {(meta != null || actions != null) && (
        <div className="page__header-aside">
          {meta != null && <span className="page__meta">{meta}</span>}
          {actions}
        </div>
      )}
    </header>
  );
}

/* ---------- PageSection ---------- */

interface PageSectionProps {
  /** Section heading. Omit head entirely when both title and actions are absent. */
  title?: ReactNode;
  /** Supporting text under the section heading. */
  description?: ReactNode;
  /** Right-aligned section action(s), typically a button. */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Element to render the section as; use "form" when it wraps a form. */
  as?: "div" | "section" | "article" | "aside" | "form";
  /** Form submit handler, used only when as="form". */
  onSubmit?: React.FormEventHandler;
  /** Drop the body padding for tables and full-bleed content. */
  flush?: boolean;
  /** Accessible name for the section. */
  label?: string;
}

/** Flat card with an optional titled head and a padded body. */
export function PageSection({
  title,
  description,
  actions,
  children,
  className,
  as = "div",
  onSubmit,
  flush = false,
  label,
}: PageSectionProps) {
  const hasHead = title != null || description != null || actions != null;
  const classes = `section${className ? ` ${className}` : ""}`;
  const body = `section__body${flush ? " section__body--flush" : ""}`;

  const content = (
    <>
      {hasHead && (
        <div className="section__head">
          <div className="section__head-text">
            {title != null && <h3 className="section__title">{title}</h3>}
            {description != null && <p className="section__description">{description}</p>}
          </div>
          {actions != null && <div className="section__actions">{actions}</div>}
        </div>
      )}
      <div className={body}>{children}</div>
    </>
  );

  if (as === "form") {
    return (
      <form className={classes} aria-label={label} onSubmit={onSubmit}>
        {content}
      </form>
    );
  }

  const Element = as;
  return (
    <Element className={classes} aria-label={label}>
      {content}
    </Element>
  );
}

/* ---------- StatTile ---------- */

interface StatTileProps {
  label: string;
  value: ReactNode;
  /** Tailwind icon component rendered in the neutral tinted square. */
  icon: React.ComponentType;
  className?: string;
}

/** Small flat stat block: tinted icon, uppercase label, bold value. */
export function StatTile({ label, value, icon: Icon, className }: StatTileProps) {
  return (
    <div className={`stat-tile${className ? ` ${className}` : ""}`}>
      <span className="stat-tile__icon" aria-hidden="true">
        <Icon />
      </span>
      <div className="stat-tile__text">
        <span className="stat-tile__label">{label}</span>
        <span className="stat-tile__value">{value}</span>
      </div>
    </div>
  );
}

/** Responsive grid wrapper for StatTile blocks. */
export function StatGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={`stat-grid${className ? ` ${className}` : ""}`}>{children}</div>;
}
