import { getAnalytics, isSupported } from "firebase/analytics";
import { type FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import {
  type User,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import type { DestinationState } from "@smart-crowd-navigator/venue-engine";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const appCheckSiteKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY?.trim();
const appCheckDebugToken =
  import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN?.trim();
const hasFirebaseConfig = [
  firebaseConfig.apiKey,
  firebaseConfig.authDomain,
  firebaseConfig.projectId,
  firebaseConfig.storageBucket,
  firebaseConfig.messagingSenderId,
  firebaseConfig.appId,
].every(Boolean);

const firebaseApp: FirebaseApp | null = hasFirebaseConfig
  ? getApps().length > 0
    ? getApp()
    : initializeApp(firebaseConfig)
  : null;

const firebaseAuth = firebaseApp ? getAuth(firebaseApp) : null;
const firestore = firebaseApp ? getFirestore(firebaseApp) : null;
const operatorStateDoc = firestore
  ? doc(firestore, "operator-state", "demoVenue")
  : null;
let appCheckHandlePromise: Promise<{
  getTokenValue: () => Promise<string | null>;
} | null> | null = null;

type OperatorSession = {
  email: string | null;
  uid: string;
};

function normalizeOperatorSession(user: User | null): OperatorSession | null {
  if (!user) {
    return null;
  }

  return {
    email: user.email,
    uid: user.uid,
  };
}

async function maybeEnableAnalytics() {
  if (
    !firebaseApp ||
    !firebaseConfig.measurementId ||
    typeof window === "undefined"
  ) {
    return;
  }

  if (await isSupported()) {
    getAnalytics(firebaseApp);
  }
}

async function getAppCheckHandle() {
  if (
    !firebaseApp ||
    !appCheckSiteKey ||
    typeof window === "undefined" ||
    typeof self === "undefined"
  ) {
    return null;
  }

  if (!appCheckHandlePromise) {
    appCheckHandlePromise = (async () => {
      if (appCheckDebugToken) {
        (
          self as typeof globalThis & {
            FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string;
          }
        ).FIREBASE_APPCHECK_DEBUG_TOKEN =
          appCheckDebugToken === "true" ? true : appCheckDebugToken;
      }

      const { ReCaptchaEnterpriseProvider, getToken, initializeAppCheck } =
        await import("firebase/app-check");
      const appCheck = initializeAppCheck(firebaseApp, {
        isTokenAutoRefreshEnabled: true,
        provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
      });

      return {
        async getTokenValue() {
          const token = await getToken(appCheck, false);
          return token.token;
        },
      };
    })().catch((error) => {
      appCheckHandlePromise = null;
      throw error;
    });
  }

  return appCheckHandlePromise;
}

void maybeEnableAnalytics();
void getAppCheckHandle().catch(() => {});

async function getFirebaseOperatorStates() {
  if (!operatorStateDoc) {
    return null;
  }

  const snapshot = await getDoc(operatorStateDoc);
  const data = snapshot.data();

  if (!data || !Array.isArray(data.states)) {
    return [];
  }

  return data.states as DestinationState[];
}

async function setFirebaseOperatorStates(states: DestinationState[]) {
  if (!operatorStateDoc) {
    return;
  }

  await setDoc(operatorStateDoc, {
    states,
    updatedAt: serverTimestamp(),
  });
}

function subscribeToFirebaseOperatorStates(
  onData: (states: DestinationState[]) => void,
  onError: (error: Error) => void,
) {
  if (!operatorStateDoc) {
    return () => {};
  }

  return onSnapshot(
    operatorStateDoc,
    (snapshot) => {
      const data = snapshot.data();

      if (data && Array.isArray(data.states)) {
        onData(data.states as DestinationState[]);
      }
    },
    (error) => onError(error),
  );
}

function subscribeToOperatorSession(
  onChange: (session: OperatorSession | null) => void,
) {
  if (!firebaseAuth) {
    onChange(null);
    return () => {};
  }

  return onAuthStateChanged(firebaseAuth, (user) => {
    onChange(normalizeOperatorSession(user));
  });
}

async function signInOperator(email: string, password: string) {
  if (!firebaseAuth) {
    throw new Error("Firebase Auth is not configured.");
  }

  await signInWithEmailAndPassword(firebaseAuth, email, password);
}

async function signOutOperator() {
  if (!firebaseAuth) {
    return;
  }

  await signOut(firebaseAuth);
}

async function getOperatorIdToken() {
  if (!firebaseAuth?.currentUser) {
    return null;
  }

  return firebaseAuth.currentUser.getIdToken();
}

async function getAppCheckToken() {
  try {
    const appCheckHandle = await getAppCheckHandle();

    if (!appCheckHandle) {
      return null;
    }

    return await appCheckHandle.getTokenValue();
  } catch {
    return null;
  }
}

export {
  getAppCheckToken,
  getFirebaseOperatorStates,
  getOperatorIdToken,
  hasFirebaseConfig,
  setFirebaseOperatorStates,
  signInOperator,
  signOutOperator,
  subscribeToFirebaseOperatorStates,
  subscribeToOperatorSession,
};
export type { OperatorSession };
