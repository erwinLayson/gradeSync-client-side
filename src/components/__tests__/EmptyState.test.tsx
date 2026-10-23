import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmptyState } from "../EmptyState";

describe("EmptyState component", () => {
  it("renders title, description, and icon accurately", () => {
    render(
      <EmptyState
        icon={<span data-testid="test-icon">🔍</span>}
        title="No Students Found"
        description="There are currently no students enrolled in this section."
      />
    );

    expect(screen.getByText("No Students Found")).toBeInTheDocument();
    expect(
      screen.getByText("There are currently no students enrolled in this section.")
    ).toBeInTheDocument();
    expect(screen.getByTestId("test-icon")).toBeInTheDocument();
  });

  it("renders optional action button and responds to click interactions", async () => {
    const handleAction = vi.fn();
    const user = userEvent.setup();

    render(
      <EmptyState
        icon={<span>📄</span>}
        title="Empty Records"
        description="Please add a record to proceed."
        action={
          <button type="button" onClick={handleAction}>
            Add Record
          </button>
        }
      />
    );

    const actionButton = screen.getByRole("button", { name: "Add Record" });
    expect(actionButton).toBeInTheDocument();

    await user.click(actionButton);
    expect(handleAction).toHaveBeenCalledTimes(1);
  });

  it("applies custom class names properly", () => {
    const { container } = render(
      <EmptyState
        icon={<span>ℹ️</span>}
        title="Custom Class Test"
        description="Testing class application"
        className="custom-empty-state"
        iconClassName="custom-icon-chip"
      />
    );

    const rootElement = container.querySelector(".empty-state");
    expect(rootElement).toHaveClass("custom-empty-state");

    const iconElement = container.querySelector(".empty-state__icon");
    expect(iconElement).toHaveClass("custom-icon-chip");
  });
});
