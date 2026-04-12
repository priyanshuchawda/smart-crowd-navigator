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
  getFirebaseOperatorStates,
  getOperatorIdToken,
  hasFirebaseConfig,
  setFirebaseOperatorStates,
  signInOperator,
  signOutOperator,
  subscribeToFirebaseOperatorStates,
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

        const firebaseStates = await getFirebaseOperatorStates();

        if (!ignore) {
          setOperatorStates(firebaseStates ?? []);
          setOperatorErrorMessage(null);
        }

        unsubscribe = subscribeToFirebaseOperatorStates(
          (states) => {
            if (ignore) {
              return;
            }

            setOperatorStates(states);
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
        await setFirebaseOperatorStates(nextStates);
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
        await setFirebaseOperatorStates(payload.states);
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
      <details className="operator-disclosure">
        <summary className="operator-disclosure-summary">
          <span>
            <strong>Demo Controls</strong>
            <span className="operator-disclosure-copy">
              Expand only if you are operating the live venue demo.
            </span>
          </span>
        </summary>

        <OperatorAccessPanel
          email={operatorEmail}
          errorMessage={operatorErrorMessage}
          isSubmitting={isOperatorSigningIn}
          onEmailChange={setOperatorEmail}
          onPasswordChange={setOperatorPassword}
          onSubmit={() => void handleOperatorSignIn()}
          password={operatorPassword}
        />
      </details>
    );
  }

  return (
    <details className="operator-disclosure">
      <summary className="operator-disclosure-summary">
        <span>
          <strong>Demo Controls</strong>
          <span className="operator-disclosure-copy">
            Venue operators can adjust live conditions here without distracting
            the attendee flow.
          </span>
        </span>
      </summary>

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
    </details>
  );
}
