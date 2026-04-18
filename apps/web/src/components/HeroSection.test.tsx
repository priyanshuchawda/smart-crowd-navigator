import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HeroSection } from "./HeroSection";

afterEach(() => {
  cleanup();
});

function renderHero(
  overrides: Partial<Parameters<typeof HeroSection>[0]> = {},
) {
  const defaults = {
    activeIntent: null as Parameters<typeof HeroSection>[0]["activeIntent"],
    onRequestFoodDemo: vi.fn(),
    onScrollToDemo: vi.fn(),
    onScrollToDemoControls: vi.fn(),
    summary: "SECTION-A12 · Party of 3 · break · standard",
  };

  return {
    props: { ...defaults, ...overrides },
    ...render(<HeroSection {...defaults} {...overrides} />),
  };
}

describe("HeroSection", () => {
  it("renders the app name as the top-level heading", () => {
    renderHero();

    expect(
      screen.getByRole("heading", { level: 1, name: "Smart Crowd Navigator" }),
    ).toBeVisible();
  });

  it("displays the current summary in the hero highlights", () => {
    renderHero({
      summary: "SECTION-C04 · Party of 5 · in-play · accessible",
    });

    expect(
      screen.getByText("SECTION-C04 · Party of 5 · in-play · accessible"),
    ).toBeVisible();
  });

  it("shows the decision mode as Choose an action when no intent is active", () => {
    renderHero({ activeIntent: null });

    expect(screen.getByText("Choose an action")).toBeVisible();
  });

  it("calls onRequestFoodDemo when Try the Food Demo is clicked", async () => {
    const { props } = renderHero();

    await userEvent.click(
      screen.getByRole("button", { name: "Try the Food Demo" }),
    );

    expect(props.onRequestFoodDemo).toHaveBeenCalledTimes(1);
  });

  it("calls onScrollToDemo when See How It Works is clicked", async () => {
    const { props } = renderHero();

    await userEvent.click(
      screen.getByRole("button", { name: "See How It Works" }),
    );

    expect(props.onScrollToDemo).toHaveBeenCalledTimes(1);
  });

  it("renders the four product benefit cards", () => {
    renderHero();

    expect(
      screen.getByText("Decision support under pressure"),
    ).toBeVisible();
    expect(screen.getByText("Wait-vs-go intelligence")).toBeVisible();
    expect(screen.getByText("Live operational awareness")).toBeVisible();
    expect(screen.getByText("Offline-ready attendee shell")).toBeVisible();
  });

  it("renders page-sections navigation with demo links", () => {
    renderHero();

    const nav = screen.getByRole("navigation", { name: "Page sections" });
    expect(nav).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try Demo" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Demo Controls" }),
    ).toBeInTheDocument();
  });

  it("calls onScrollToDemoControls from the Demo Controls link", async () => {
    const { props } = renderHero();

    await userEvent.click(
      screen.getByRole("button", { name: "Demo Controls" }),
    );

    expect(props.onScrollToDemoControls).toHaveBeenCalledTimes(1);
  });
});
