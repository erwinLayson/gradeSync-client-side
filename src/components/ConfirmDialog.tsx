import {
  useCallback,
  useEffect,
  useId,
  useRef,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { FiAlertTriangle, FiX } from "react-icons/fi";

import "../style/confirmDialog.css";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  /** Optional icon rendered inside the confirm button. */
  confirmIcon?: ReactNode;
  /** Optional badge icon above the title. Defaults to a warning triangle. */
  icon?: ReactNode;
  /** Visual tone of the confirm action. Defaults to "danger". */
  tone?: "danger" | "primary";
  /** Show a busy state on the confirm button (e.g. while an API call runs). */
  pending?: boolean;
  /** Label shown instead of confirmLabel while pending. */
  pendingLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
  /** Button to return focus to when the dialog closes. */
  triggerRef?: RefObject<HTMLButtonElement | null>;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  confirmIcon,
  icon,
  tone = "danger",
  pending = false,
  pendingLabel,
  onConfirm,
  onClose,
  triggerRef,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  const closeAndRestoreFocus = useCallback(() => {
    onClose();
    // The trigger always lives outside the dialog, so focus can move to it
    // synchronously before the dialog unmounts.
    triggerRef?.current?.focus();
  }, [onClose, triggerRef]);

  function handleOverlayMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) {
      closeAndRestoreFocus();
    }
  }

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeAndRestoreFocus();
        return;
      }

      // Trap Tab / Shift+Tab inside the dialog panel
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
  }, [open, closeAndRestoreFocus]);

  if (!open) return null;

  // Rendered through a portal so the overlay is a direct child of <body>.
  // Fixed-position overlays are positioned relative to the nearest ancestor
  // with a transform/filter — e.g. the sidebar drawer on mobile — which would
  // otherwise clip and mis-center the dialog.
  return createPortal(
    <div
      className="confirm-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
      onMouseDown={handleOverlayMouseDown}
    >
      <div ref={panelRef} className="confirm-dialog__panel">
        <button
          type="button"
          className="confirm-dialog__close"
          onClick={closeAndRestoreFocus}
          aria-label="Close dialog"
        >
          <FiX aria-hidden="true" />
        </button>

        <span
          className={`confirm-dialog__icon${tone === "primary" ? " confirm-dialog__icon--primary" : ""}`}
          aria-hidden="true"
        >
          {icon ?? <FiAlertTriangle />}
        </span>
        <h2 id={titleId} className="confirm-dialog__title">
          {title}
        </h2>
        <p id={descId} className="confirm-dialog__text">
          {description}
        </p>

        <div className="confirm-dialog__actions">
          <button
            type="button"
            className="confirm-dialog__cancel"
            onClick={closeAndRestoreFocus}
            autoFocus
          >
            Cancel
          </button>
          <button
            type="button"
            className={`confirm-dialog__confirm confirm-dialog__confirm--${tone}`}
            onClick={onConfirm}
            disabled={pending}
          >
            {confirmIcon}
            {pending ? pendingLabel ?? confirmLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
