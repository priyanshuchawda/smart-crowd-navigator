import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppErrorBoundary } from "./AppErrorBoundary";

function ThrowsOnRender(): ReactElement {
  throw new Error("render failure");
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AppErrorBoundary", () => {
  it("renders children when no error is thrown", () => {
    render(
      <AppErrorBoundary>
        <div>Healthy child</div>
      </AppErrorBoundary>,
    );

    expect(screen.getByText("Healthy child")).toBeVisible();
  });

  it("renders fallback UI when a child throws", () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    render(
      <AppErrorBoundary>
        <ThrowsOnRender />
      </AppErrorBoundary>,
    );

    expect(
      screen.getByText(/The app hit an unexpected rendering error\./),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Try again" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Reload app" })).toBeVisible();

    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("offers a retry action after fallback", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    render(
      <AppErrorBoundary>
        <ThrowsOnRender />
      </AppErrorBoundary>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(screen.getByRole("button", { name: "Reload app" })).toBeVisible();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});
