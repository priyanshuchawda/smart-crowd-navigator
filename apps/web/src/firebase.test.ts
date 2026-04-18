import { describe, expect, it, vi } from "vitest";

import {
  getAppCheckToken,
  getFirebaseLiveVenueStateSnapshot,
  getOperatorIdToken,
  hasFirebaseConfig,
  setFirebaseLiveVenueState,
  signInOperator,
  signInOperatorWithGoogle,
  signOutOperator,
  subscribeToOperatorSession,
} from "./firebase";

const runWhenFirebaseDisabled = hasFirebaseConfig ? it.skip : it;

describe("firebase module without configured credentials", () => {
  runWhenFirebaseDisabled(
    "exposes firebase-disabled behavior safely",
    async () => {
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
    },
  );

  runWhenFirebaseDisabled(
    "notifies operator session subscribers with null session",
    () => {
      const onChange = vi.fn();

      const unsubscribe = subscribeToOperatorSession(onChange);

      expect(onChange).toHaveBeenCalledWith(null);
      expect(typeof unsubscribe).toBe("function");
    },
  );
});
