import {
  useCallback,
  useEffect,
  useRef,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

import "../style/modalDialog.css";

interface ModalDialogProps {
  /** Render the dialog when true. */
  open: boolean;
  /** Called when the dialog should close (Escape, backdrop click, close action). */
  onClose: () => void;
  children: ReactNode;
  /** Class applied to the panel wrapper (width, radius, page-specific styles). */
  className?: string;
  /** Element id referenced by aria-labelledby (the dialog's accessible name). */
  labelledById?: string;
  /** Plain-text accessible name used when labelledById is not provided. */
  ariaLabel?: string;
  /** Element id referenced by aria-describedby (longer supporting text). */
  describedById?: string;
  /** Focus this element when the dialog opens. Defaults to `[autofocus]`. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Return focus to this element when the dialog closes. */
  restoreFocusRef?: RefObject<HTMLElement | null>;
  /** While true, Escape and backdrop clicks do not close the dialog (in-flight work). */
  lockClose?: boolean;
}

/**
 * Shared modal primitive: portal-rendered overlay with a focus trap, Escape
 * close, backdrop close, body scroll-lock, and ARIA dialog semantics.
 *
 * Rendered through a portal so the overlay is a direct child of <body>.
 * Fixed-position overlays are positioned relative to the nearest ancestor
 * with a transform/filter — e.g. the sidebar drawer on mobile — which would
 * otherwise clip and mis-center the dialog.
 */
export function ModalDialog({
  open,
  onClose,
  children,
  className,
  labelledById,
  ariaLabel,
  describedById,
  initialFocusRef,
  restoreFocusRef,
  lockClose = false,
}: ModalDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  const closeAndRestoreFocus = useCallback(() => {
    onClose();
    // The trigger always lives outside the dialog, so focus can move to it
    // synchronously before the dialog unmounts.
    restoreFocusRef?.current?.focus();
  }, [onClose, restoreFocusRef]);

  function handleOverlayMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget && !lockClose) {
      closeAndRestoreFocus();
    }
  }

  useEffect(() => {
    if (!open) return;

    // Move focus into the dialog so it starts inside the trapped region.
    const focusTarget =
      initialFocusRef?.current ??
      panelRef.current?.querySelector<HTMLElement>(
        "[autofocus], button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
      );
    requestAnimationFrame(() => focusTarget?.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!lockClose) closeAndRestoreFocus();
        return;
      }

      // Trap Tab / Shift+Tab inside the dialog panel.
      if (event.key === "Tab" && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, closeAndRestoreFocus, lockClose, initialFocusRef]);

  if (!open) return null;

  return createPortal(
    <div
      className="modal-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledById}
      aria-label={ariaLabel}
      aria-describedby={describedById}
      onMouseDown={handleOverlayMouseDown}
    >
      <div ref={panelRef} className={className}>
        {children}
      </div>
    </div>,
    document.body,
  );
}