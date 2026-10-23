import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { KpiCard } from "../components/KpiCard";

const DummyIcon = () => <svg data-testid="dummy-icon" />;

describe("KpiCard component", () => {
  it("renders label, value, and icon correctly", () => {
    render(
      <KpiCard
        label="Total Enrolled"
        value="1,245"
        icon={DummyIcon}
      />
    );

    expect(screen.getByText("Total Enrolled")).toBeInTheDocument();
    expect(screen.getByText("1,245")).toBeInTheDocument();
    expect(screen.getByTestId("dummy-icon")).toBeInTheDocument();
  });

  it("renders trend badge when trend prop is provided", () => {
    render(
      <KpiCard
        label="Average Attendance"
        value="94.2%"
        trend={{ tone: "up", text: "+2.5% this month" }}
        icon={DummyIcon}
      />
    );

    const trendElement = screen.getByText("+2.5% this month");
    expect(trendElement).toBeInTheDocument();
    expect(trendElement).toHaveClass("analytics__trend--up");
  });

  it("renders loading skeletons when loading is true", () => {
    const { container } = render(
      <KpiCard
        label="Pending Approvals"
        value="18"
        trend={{ tone: "down", text: "-5" }}
        icon={DummyIcon}
        loading={true}
      />
    );

    // When loading, value and icon should be replaced by skeletons
    expect(screen.queryByText("18")).not.toBeInTheDocument();
    expect(screen.queryByTestId("dummy-icon")).not.toBeInTheDocument();
    expect(screen.queryByText("-5")).not.toBeInTheDocument();

    const skeletons = container.querySelectorAll(".skeleton__bar");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("applies accent icon class when iconAccent is true", () => {
    const { container } = render(
      <KpiCard
        label="At Risk"
        value="3"
        icon={DummyIcon}
        iconAccent={true}
      />
    );

    const iconWrapper = container.querySelector(".analytics__kpi-icon");
    expect(iconWrapper).toHaveClass("analytics__kpi-icon--accent");
  });
});
