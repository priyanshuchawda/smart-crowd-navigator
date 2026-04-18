import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createRootMock, renderMock } = vi.hoisted(() => {
  const renderMock = vi.fn();
  const createRootMock = vi.fn(() => ({
    render: renderMock,
  }));

  return {
    createRootMock,
    renderMock,
  };
});

vi.mock("react-dom/client", () => ({
  default: {
    createRoot: createRootMock,
  },
}));

vi.mock("./App", () => ({
  App: () => null,
}));

vi.mock("./components/AppErrorBoundary", () => ({
  AppErrorBoundary: ({ children }: { children: ReactNode }) => children,
}));

async function loadMainModule() {
  return import("./main");
}

describe("main entrypoint", () => {
  beforeEach(() => {
    vi.resetModules();
    createRootMock.mockClear();
    renderMock.mockClear();
    document.body.innerHTML = "";
  });

  it("throws when root element is missing", async () => {
    await expect(loadMainModule()).rejects.toThrow("Root element not found");
  });

  it("mounts the app into the root element", async () => {
    const rootElement = document.createElement("div");
    rootElement.id = "root";
    document.body.append(rootElement);

    await loadMainModule();

    expect(createRootMock).toHaveBeenCalledWith(rootElement);
    expect(renderMock).toHaveBeenCalledTimes(1);
  });
});
