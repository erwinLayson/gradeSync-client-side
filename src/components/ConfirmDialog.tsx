import {
  useId,
  type ReactNode,
  type RefObject,
} from "react";
import { FiAlertTriangle, FiX } from "react-icons/fi";

import { ModalDialog } from "./ModalDialog";
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

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      labelledById={titleId}
      describedById={descId}
      restoreFocusRef={triggerRef}
      lockClose={pending}
      className="confirm-dialog__panel"
    >
      <button
        type="button"
        className="confirm-dialog__close"
        onClick={onClose}
        disabled={pending}
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
          onClick={onClose}
          disabled={pending}
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
    </ModalDialog>
  );
}