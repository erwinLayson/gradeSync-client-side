import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FiBookOpen, FiUserCheck } from "react-icons/fi";

import { TabNav, type TabItem } from "../components/TabNav";

describe("TabNav Component (Single Source of Truth for Tab Links)", () => {
  const sampleTabs: TabItem<"subjects" | "adviser" | "archived">[] = [
    {
      id: "subjects",
      label: "My Assigned Subjects",
      icon: FiBookOpen,
      count: 3,
    },
    {
      id: "adviser",
      label: "Advised Class Matrix",
      icon: FiUserCheck,
    },
    {
      id: "archived",
      label: "Archived",
      disabled: true,
    },
  ];

  it("renders all enabled and disabled tabs with icons, labels, and count badges", () => {
    const handleChange = vi.fn();

    render(
      <TabNav
        tabs={sampleTabs}
        activeTab="subjects"
        onChange={handleChange}
        ariaLabel="Sample Navigation"
      />
    );

    const tablist = screen.getByRole("tablist", { name: "Sample Navigation" });
    expect(tablist).toBeInTheDocument();

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(3);

    expect(screen.getByText("My Assigned Subjects")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Advised Class Matrix")).toBeInTheDocument();
    expect(screen.getByText("Archived")).toBeInTheDocument();

    // Verify active tab attributes
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(tabs[0]).toHaveAttribute("tabindex", "0");

    // Verify inactive tab attributes
    expect(tabs[1]).toHaveAttribute("aria-selected", "false");
    expect(tabs[1]).toHaveAttribute("tabindex", "-1");

    // Verify disabled tab
    expect(tabs[2]).toBeDisabled();
  });

  it("fires onChange with the tab id when an inactive tab is clicked", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <TabNav
        tabs={sampleTabs}
        activeTab="subjects"
        onChange={handleChange}
      />
    );

    const adviserTab = screen.getByRole("tab", { name: /Advised Class Matrix/i });
    await user.click(adviserTab);

    expect(handleChange).toHaveBeenCalledWith("adviser");
  });

  it("does not fire onChange when clicking a disabled tab", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <TabNav
        tabs={sampleTabs}
        activeTab="subjects"
        onChange={handleChange}
      />
    );

    const disabledTab = screen.getByRole("tab", { name: /Archived/i });
    await user.click(disabledTab);

    expect(handleChange).not.toHaveBeenCalled();
  });

  it("supports keyboard navigation with ArrowRight and ArrowLeft keys", () => {
    const handleChange = vi.fn();

    render(
      <TabNav
        tabs={sampleTabs}
        activeTab="subjects"
        onChange={handleChange}
      />
    );

    const subjectsTab = screen.getByRole("tab", { name: /My Assigned Subjects/i });
    subjectsTab.focus();

    // Press ArrowRight to navigate to next enabled tab
    fireEvent.keyDown(subjectsTab, { key: "ArrowRight" });
    expect(handleChange).toHaveBeenCalledWith("adviser");

    // Press ArrowLeft to navigate back to previous tab
    const adviserTab = screen.getByRole("tab", { name: /Advised Class Matrix/i });
    fireEvent.keyDown(adviserTab, { key: "ArrowLeft" });
    expect(handleChange).toHaveBeenCalledWith("subjects");
  });

  it("supports Home and End keyboard shortcuts", () => {
    const handleChange = vi.fn();

    render(
      <TabNav
        tabs={sampleTabs}
        activeTab="adviser"
        onChange={handleChange}
      />
    );

    const adviserTab = screen.getByRole("tab", { name: /Advised Class Matrix/i });
    adviserTab.focus();

    // Press Home to jump to first tab
    fireEvent.keyDown(adviserTab, { key: "Home" });
    expect(handleChange).toHaveBeenCalledWith("subjects");

    // Press End to jump to last enabled tab (skipping disabled 'archived')
    fireEvent.keyDown(adviserTab, { key: "End" });
    expect(handleChange).toHaveBeenCalledWith("adviser");
  });
});
