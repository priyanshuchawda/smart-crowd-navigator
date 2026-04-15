import { useEffect, useState } from "react";

import type { CoreIntent } from "@smart-crowd-navigator/shared";
import type { DestinationState } from "@smart-crowd-navigator/venue-engine";

import {
  getOperatorState,
  resetOperatorState,
  syncOperatorStates,
  updateOperatorState,
} from "../api";
import {
  type OperatorSession,
  getFirebaseLiveVenueStateSnapshot,
  getOperatorIdToken,
  hasFirebaseConfig,
  setFirebaseLiveVenueState,
  signInOperator,
  signOutOperator,
  subscribeToFirebaseLiveVenueState,
  subscribeToOperatorSession,
} from "../firebase";
import { OperatorAccessPanel } from "./OperatorAccessPanel";
import { OperatorPanel } from "./OperatorPanel";

interface OperatorExperienceProps {
  activeIntent: CoreIntent | null;
  onRequestRecommendation: (
    intent: CoreIntent,
    options?: {
      announceUser?: boolean;
      assistantPrefix?: string;
    },
  ) => Promise<void>;
}

export function OperatorExperience({
  activeIntent,
  onRequestRecommendation,
}: OperatorExperienceProps) {
  const [operatorStates, setOperatorStates] = useState<DestinationState[]>([]);
  const [operatorErrorMessage, setOperatorErrorMessage] = useState<
    string | null
  >(null);
  const [isOperatorUpdating, setIsOperatorUpdating] = useState(false);
  const [operatorSession, setOperatorSession] =
    useState<OperatorSession | null>(null);
  const [operatorEmail, setOperatorEmail] = useState("");
  const [operatorPassword, setOperatorPassword] = useState("");
  const [isOperatorSigningIn, setIsOperatorSigningIn] = useState(false);

  useEffect(() => subscribeToOperatorSession(setOperatorSession), []);

  useEffect(() => {
    if (!hasFirebaseConfig || !operatorSession || operatorStates.length === 0) {
      return;
    }

    let ignore = false;

    async function syncAuthorizedSnapshot() {
      try {
        const idToken = await getOperatorIdToken();

        if (!idToken || ignore) {
          return;
        }

        await syncOperatorStates(operatorStates, idToken);
      } catch {
        if (!ignore) {
          setOperatorErrorMessage(
            "Operator sync to the local API failed. Live recommendations may lag until the next successful operator update.",
          );
        }
      }
    }

    void syncAuthorizedSnapshot();

    return () => {
      ignore = true;
    };
  }, [operatorSession, operatorStates]);

  useEffect(() => {
    let ignore = false;
    let unsubscribe = () => {};

    const loadLocalState = async (message?: string) => {
      const payload = await getOperatorState();

      if (!ignore) {
        setOperatorStates(payload.states);
        setOperatorErrorMessage(message ?? null);
      }
    };

    async function bootstrapOperatorState() {
      try {
        if (!hasFirebaseConfig) {
          await loadLocalState();
          return;
        }

        const firebaseSnapshot = await getFirebaseLiveVenueStateSnapshot();

        if (!ignore) {
          setOperatorStates(firebaseSnapshot?.states ?? []);
          setOperatorErrorMessage(null);
        }

        unsubscribe = subscribeToFirebaseLiveVenueState(
          (snapshot) => {
            if (ignore) {
              return;
            }

            setOperatorStates(snapshot.states);
            setOperatorErrorMessage(null);

            if (activeIntent) {
              void onRequestRecommendation(activeIntent, {
                announceUser: false,
                assistantPrefix: "Live update:",
              });
            }
          },
          async () => {
            await loadLocalState(
              "Firebase operator sync failed, using local API state.",
            );
          },
        );
      } catch {
        await loadLocalState(
          "Firebase operator sync failed, using local API state.",
        );
      }
    }

    void bootstrapOperatorState();

    return () => {
      ignore = true;
      unsubscribe();
    };
  }, [activeIntent, onRequestRecommendation]);

  async function handleOperatorSignIn() {
    setIsOperatorSigningIn(true);
    setOperatorErrorMessage(null);

    try {
      await signInOperator(operatorEmail.trim(), operatorPassword);
      setOperatorPassword("");
    } catch (error) {
      setOperatorErrorMessage(
        error instanceof Error
          ? error.message
          : "Operator sign-in failed. Try again.",
      );
    } finally {
      setIsOperatorSigningIn(false);
    }
  }

  async function handleOperatorSignOut() {
    setOperatorErrorMessage(null);
    await signOutOperator();
  }

  async function handleOperatorUpdate(nextState: DestinationState) {
    setIsOperatorUpdating(true);
    setOperatorErrorMessage(null);

    try {
      if (hasFirebaseConfig) {
        const idToken = await getOperatorIdToken();

        if (!idToken) {
          throw new Error("Sign in as an operator before updating live state.");
        }

        const nextStates = operatorStates.map((state) =>
          state.nodeId === nextState.nodeId ? nextState : state,
        );
        await syncOperatorStates(nextStates, idToken);
        await setFirebaseLiveVenueState(nextStates, {
          updatedBy: operatorSession?.uid ?? null,
        });
      } else {
        const payload = await updateOperatorState(nextState);
        setOperatorStates(payload.states);

        if (activeIntent) {
          await onRequestRecommendation(activeIntent, {
            announceUser: false,
            assistantPrefix: "Live update:",
          });
        }
      }
    } catch (error) {
      setOperatorErrorMessage(
        error instanceof Error
          ? error.message
          : "Operator update failed. Try again.",
      );
    } finally {
      setIsOperatorUpdating(false);
    }
  }

  async function handleOperatorReset() {
    setIsOperatorUpdating(true);
    setOperatorErrorMessage(null);

    try {
      if (hasFirebaseConfig) {
        const idToken = await getOperatorIdToken();

        if (!idToken) {
          throw new Error(
            "Sign in as an operator before resetting live state.",
          );
        }

        const payload = await resetOperatorState(idToken);
        await setFirebaseLiveVenueState(payload.states, {
          updatedBy: operatorSession?.uid ?? null,
        });
      } else {
        const payload = await resetOperatorState();
        setOperatorStates(payload.states);

        if (activeIntent) {
          await onRequestRecommendation(activeIntent, {
            announceUser: false,
            assistantPrefix: "Live update:",
          });
        }
      }
    } catch (error) {
      setOperatorErrorMessage(
        error instanceof Error
          ? error.message
          : "Operator reset failed. Try again.",
      );
    } finally {
      setIsOperatorUpdating(false);
    }
  }

  const showOperatorAccessPanel = hasFirebaseConfig && !operatorSession;

  if (showOperatorAccessPanel) {
    return (
      <OperatorAccessPanel
        email={operatorEmail}
        errorMessage={operatorErrorMessage}
        isSubmitting={isOperatorSigningIn}
        onEmailChange={setOperatorEmail}
        onPasswordChange={setOperatorPassword}
        onSubmit={() => void handleOperatorSignIn()}
        password={operatorPassword}
      />
    );
  }

  return (
    <OperatorPanel
      currentOperatorEmail={operatorSession?.email}
      errorMessage={operatorErrorMessage}
      isUpdating={isOperatorUpdating}
      onReset={() => void handleOperatorReset()}
      onSignOut={
        operatorSession ? () => void handleOperatorSignOut() : undefined
      }
      onUpdate={(state) => void handleOperatorUpdate(state)}
      states={operatorStates}
    />
  );
}
