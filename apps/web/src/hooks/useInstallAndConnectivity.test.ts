import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DeferredInstallPromptEvent } from "./useInstallAndConnectivity";
import { useInstallAndConnectivity } from "./useInstallAndConnectivity";

function setNavigatorOnlineState(isOnline: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value: isOnline,
  });
}

function createInstallPromptEvent(options?: {
  outcome?: "accepted" | "dismissed";
  rejectUserChoice?: boolean;
}) {
  const prompt = vi.fn().mockResolvedValue(undefined);
  const userChoice = options?.rejectUserChoice
    ? Promise.reject(new Error("user choice failed"))
    : Promise.resolve({ outcome: options?.outcome ?? "accepted" });

  const event = new Event("beforeinstallprompt") as DeferredInstallPromptEvent;
  const preventDefault = vi.fn();

  Object.defineProperty(event, "prompt", {
    configurable: true,
    value: prompt,
  });
  Object.defineProperty(event, "userChoice", {
    configurable: true,
    value: userChoice,
  });
  Object.defineProperty(event, "preventDefault", {
    configurable: true,
    value: preventDefault,
  });

  return {
    event,
    preventDefault,
    prompt,
  };
}

afterEach(() => {
  cleanup();
  setNavigatorOnlineState(true);
});

describe("useInstallAndConnectivity", () => {
  it("uses navigator online state for initial offline status", () => {
    setNavigatorOnlineState(false);

    const { result } = renderHook(() => useInstallAndConnectivity());

    expect(result.current.isOffline).toBe(true);
  });

  it("reacts to browser offline and online events", async () => {
    setNavigatorOnlineState(true);

    const { result } = renderHook(() => useInstallAndConnectivity());

    expect(result.current.isOffline).toBe(false);

    act(() => {
      window.dispatchEvent(new Event("offline"));
    });

    expect(result.current.isOffline).toBe(true);

    act(() => {
      window.dispatchEvent(new Event("online"));
    });

    await waitFor(() => {
      expect(result.current.isOffline).toBe(false);
    });
  });

  it("captures install prompt, runs prompt flow, and clears prompt state", async () => {
    const { event, preventDefault, prompt } = createInstallPromptEvent({
      outcome: "accepted",
    });

    const { result } = renderHook(() => useInstallAndConnectivity());

    act(() => {
      window.dispatchEvent(event);
    });

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(result.current.installPrompt).toBe(event);

    await act(async () => {
      await result.current.handleInstallApp();
    });

    expect(prompt).toHaveBeenCalledTimes(1);
    expect(result.current.installPrompt).toBeNull();
  });

  it("clears install prompt even when userChoice rejects", async () => {
    const { event, prompt } = createInstallPromptEvent({
      rejectUserChoice: true,
    });

    const { result } = renderHook(() => useInstallAndConnectivity());

    act(() => {
      window.dispatchEvent(event);
    });

    await act(async () => {
      await result.current.handleInstallApp();
    });

    expect(prompt).toHaveBeenCalledTimes(1);
    expect(result.current.installPrompt).toBeNull();
  });

  it("no-ops install handler when no install prompt is available", async () => {
    const { result } = renderHook(() => useInstallAndConnectivity());

    await act(async () => {
      await result.current.handleInstallApp();
    });

    expect(result.current.installPrompt).toBeNull();
  });
});
