import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "../ConfirmDialog";

describe("ConfirmDialog component", () => {
  it("does not render when open is false", () => {
    render(
      <ConfirmDialog
        open={false}
        title="Delete Record"
        description="Are you sure you want to delete this record?"
        confirmLabel="Delete"
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders title, description, and action buttons when open is true", () => {
    render(
      <ConfirmDialog
        open={true}
        title="Confirm Enrollment"
        description="Proceed with enrolling this student?"
        confirmLabel="Enroll"
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Confirm Enrollment")).toBeInTheDocument();
    expect(
      screen.getByText("Proceed with enrolling this student?")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enroll" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("calls onConfirm when the confirm button is clicked", async () => {
    const handleConfirm = vi.fn();
    const handleClose = vi.fn();
    const user = userEvent.setup();

    render(
      <ConfirmDialog
        open={true}
        title="Approve Request"
        description="Do you want to approve this request?"
        confirmLabel="Approve"
        onConfirm={handleConfirm}
        onClose={handleClose}
      />
    );

    const confirmBtn = screen.getByRole("button", { name: "Approve" });
    await user.click(confirmBtn);

    expect(handleConfirm).toHaveBeenCalledTimes(1);
    expect(handleClose).not.toHaveBeenCalled();
  });

  it("calls onClose when the cancel button or header close button is clicked", async () => {
    const handleConfirm = vi.fn();
    const handleClose = vi.fn();
    const user = userEvent.setup();

    render(
      <ConfirmDialog
        open={true}
        title="Discard Changes"
        description="All unsaved changes will be lost."
        confirmLabel="Discard"
        onConfirm={handleConfirm}
        onClose={handleClose}
      />
    );

    const cancelBtn = screen.getByRole("button", { name: "Cancel" });
    await user.click(cancelBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);

    const closeHeaderBtn = screen.getByRole("button", { name: "Close dialog" });
    await user.click(closeHeaderBtn);
    expect(handleClose).toHaveBeenCalledTimes(2);
  });

  it("displays pendingLabel and disables action buttons when pending is true", () => {
    render(
      <ConfirmDialog
        open={true}
        title="Saving Record"
        description="Please wait..."
        confirmLabel="Save"
        pending={true}
        pendingLabel="Saving..."
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const confirmBtn = screen.getByRole("button", { name: "Saving..." });
    const cancelBtn = screen.getByRole("button", { name: "Cancel" });
    const closeHeaderBtn = screen.getByRole("button", { name: "Close dialog" });

    expect(confirmBtn).toBeDisabled();
    expect(cancelBtn).toBeDisabled();
    expect(closeHeaderBtn).toBeDisabled();
  });

  it("applies primary tone class when tone is set to primary", () => {
    render(
      <ConfirmDialog
        open={true}
        title="Publish Notice"
        description="Publish notice to all students?"
        confirmLabel="Publish"
        tone="primary"
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const confirmBtn = screen.getByRole("button", { name: "Publish" });
    expect(confirmBtn).toHaveClass("confirm-dialog__confirm--primary");
  });
});
