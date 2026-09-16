import type { ReactNode } from "react";

interface EmptyStateProps {
  /** Decorative icon; rendered with aria-hidden inside a circular chip. */
  icon: ReactNode;
  /** Short one-line summary, e.g. "No teachers found". */
  title: ReactNode;
  /** Supporting sentence, e.g. "Teacher records will appear here once staff are registered." */
  description: ReactNode;
  /** Optional slot below the text (e.g. a create action button). */
  action?: ReactNode;
  /** Optional page-specific classes (BEM hook + layout tweaks). */
  className?: string;
  /** Extra classes for the icon chip when a page needs custom icon styling. */
  iconClassName?: string;
}

/**
 * Shared empty-state block — the icon + title + description pattern every
 * page repeats (`flex flex-col items-center justify-center px-6 py-14 text-center`).
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  iconClassName,
}: EmptyStateProps) {
  return (
    <div
      className={`empty-state flex flex-col items-center justify-center px-6 py-14 text-center${
        className ? ` ${className}` : ""
      }`}
    >
      <span
        className={`empty-state__icon inline-flex h-12 w-12 items-center justify-center rounded-full${
          iconClassName ? ` ${iconClassName}` : ""
        }`}
        aria-hidden="true"
      >
        {icon}
      </span>
      <p className="empty-state__title mt-3 text-sm font-bold">{title}</p>
      <p className="empty-state__text mt-1 text-[0.8125rem]">{description}</p>
      {action}
    </div>
  );
}
