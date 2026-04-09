import { getAnalytics, isSupported } from "firebase/analytics";
import { getApp, getApps, initializeApp } from "firebase/app";
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

const hasFirebaseConfig = [
  firebaseConfig.apiKey,
  firebaseConfig.authDomain,
  firebaseConfig.projectId,
  firebaseConfig.storageBucket,
  firebaseConfig.messagingSenderId,
  firebaseConfig.appId,
].every(Boolean);

const firebaseApp = hasFirebaseConfig
  ? getApps().length > 0
    ? getApp()
    : initializeApp(firebaseConfig)
  : null;

const firestore = firebaseApp ? getFirestore(firebaseApp) : null;
const operatorStateDoc = firestore
  ? doc(firestore, "operator-state", "demoVenue")
  : null;

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

void maybeEnableAnalytics();

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

export {
  getFirebaseOperatorStates,
  hasFirebaseConfig,
  setFirebaseOperatorStates,
  subscribeToFirebaseOperatorStates,
};
