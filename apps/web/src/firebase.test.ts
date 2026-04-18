import { beforeEach, describe, expect, it, vi } from "vitest";

function setFirebaseEnvDisabled() {
  vi.stubEnv("VITE_FIREBASE_API_KEY", "");
  vi.stubEnv("VITE_FIREBASE_AUTH_DOMAIN", "");
  vi.stubEnv("VITE_FIREBASE_PROJECT_ID", "");
  vi.stubEnv("VITE_FIREBASE_STORAGE_BUCKET", "");
  vi.stubEnv("VITE_FIREBASE_MESSAGING_SENDER_ID", "");
  vi.stubEnv("VITE_FIREBASE_APP_ID", "");
  vi.stubEnv("VITE_FIREBASE_MEASUREMENT_ID", "");
  vi.stubEnv("VITE_FIREBASE_APPCHECK_SITE_KEY", "");
  vi.stubEnv("VITE_FIREBASE_APPCHECK_DEBUG_TOKEN", "");
}

async function loadFirebaseModule() {
  return import("./firebase");
}

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  setFirebaseEnvDisabled();
});

describe("firebase module without configured credentials", () => {
  it("exposes firebase-disabled behavior safely", async () => {
    const {
      getAppCheckToken,
      getFirebaseLiveVenueStateSnapshot,
      getOperatorIdToken,
      hasFirebaseConfig,
      setFirebaseLiveVenueState,
      signInOperator,
      signInOperatorWithGoogle,
      signOutOperator,
    } = await loadFirebaseModule();

    expect(hasFirebaseConfig).toBe(false);
    expect(await getOperatorIdToken()).toBeNull();
    expect(await getFirebaseLiveVenueStateSnapshot()).toBeNull();
    expect(await getAppCheckToken()).toBeNull();

    await expect(signOutOperator()).resolves.toBeUndefined();
    await expect(setFirebaseLiveVenueState([])).resolves.toBeUndefined();

    await expect(
      signInOperator("operator@example.com", "secret"),
    ).rejects.toThrow("Firebase Auth is not configured.");

    await expect(signInOperatorWithGoogle()).rejects.toThrow(
      "Firebase Auth is not configured.",
    );
  }, 20_000);

  it("notifies operator session subscribers with null session", async () => {
    const { subscribeToOperatorSession } = await loadFirebaseModule();
    const onChange = vi.fn();

    const unsubscribe = subscribeToOperatorSession(onChange);

    expect(onChange).toHaveBeenCalledWith(null);
    expect(typeof unsubscribe).toBe("function");
  });
});
