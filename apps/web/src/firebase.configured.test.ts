import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type AuthUserLike = {
  email: string | null;
  uid: string;
};

type SnapshotLike = {
  data: () => unknown;
  exists: () => boolean;
};

type DocRefLike = {
  path: string;
};

const {
  analyticsGetAnalyticsMock,
  analyticsIsSupportedMock,
  appCheckGetTokenMock,
  appCheckInitializeMock,
  appGetAppMock,
  appGetAppsMock,
  appInitializeAppMock,
  appInstance,
  authGetAuthMock,
  authInstance,
  authOnAuthStateChangedMock,
  authSignInEmailMock,
  authSignInPopupMock,
  authSignOutMock,
  firestoreDocMock,
  firestoreGetDocMock,
  firestoreGetFirestoreMock,
  firestoreOnSnapshotMock,
  firestoreServerTimestampMock,
  firestoreSetDocMock,
  googleAuthProviderCtorMock,
  recaptchaProviderCtorMock,
} = vi.hoisted(() => {
  const analyticsGetAnalyticsMock = vi.fn();
  const analyticsIsSupportedMock = vi.fn(async () => false);

  const appInstance = { name: "mock-firebase-app" };
  const appGetAppsMock = vi.fn(() => []);
  const appGetAppMock = vi.fn(() => appInstance);
  const appInitializeAppMock = vi.fn(() => appInstance);

  const authInstance: {
    currentUser: null | {
      getIdToken: () => Promise<string>;
    };
  } = {
    currentUser: null,
  };

  const authGetAuthMock = vi.fn(() => authInstance);
  const authOnAuthStateChangedMock = vi.fn(
    (_auth: unknown, onChange: (user: AuthUserLike | null) => void) => {
      onChange(null);
      return () => {};
    },
  );
  const authSignInEmailMock = vi.fn(async () => undefined);
  const authSignInPopupMock = vi.fn(async () => undefined);
  const authSignOutMock = vi.fn(async () => undefined);

  const googleAuthProviderCtorMock = vi.fn();

  const firestoreInstance = { id: "mock-firestore" };
  const firestoreGetFirestoreMock = vi.fn(() => firestoreInstance);
  const firestoreDocMock = vi.fn(
    (_store: unknown, collection: string, id: string) => ({
      path: `${collection}/${id}`,
    }),
  );
  const firestoreGetDocMock = vi.fn<
    (docRef: DocRefLike) => Promise<SnapshotLike>
  >(async () => ({
    data: () => undefined,
    exists: () => false,
  }));
  const firestoreOnSnapshotMock = vi.fn(
    (
      _docRef: unknown,
      _onData: (snapshot: SnapshotLike) => void,
      _onError: (error: Error) => void,
    ) => {
      return () => {};
    },
  );
  const firestoreServerTimestampMock = vi.fn(() => "mock-server-timestamp");
  const firestoreSetDocMock = vi.fn(async () => undefined);

  const appCheckInitializeMock = vi.fn(() => ({ id: "mock-app-check" }));
  const appCheckGetTokenMock = vi.fn(async () => ({
    token: "app-check-token",
  }));
  const recaptchaProviderCtorMock = vi.fn();

  return {
    analyticsGetAnalyticsMock,
    analyticsIsSupportedMock,
    appCheckGetTokenMock,
    appCheckInitializeMock,
    appGetAppMock,
    appGetAppsMock,
    appInitializeAppMock,
    appInstance,
    authGetAuthMock,
    authInstance,
    authOnAuthStateChangedMock,
    authSignInEmailMock,
    authSignInPopupMock,
    authSignOutMock,
    firestoreDocMock,
    firestoreGetDocMock,
    firestoreGetFirestoreMock,
    firestoreOnSnapshotMock,
    firestoreServerTimestampMock,
    firestoreSetDocMock,
    googleAuthProviderCtorMock,
    recaptchaProviderCtorMock,
  };
});

class GoogleAuthProvider {
  constructor() {
    googleAuthProviderCtorMock();
  }
}

class ReCaptchaEnterpriseProvider {
  constructor(siteKey: string) {
    recaptchaProviderCtorMock(siteKey);
  }
}

vi.mock("firebase/analytics", () => ({
  getAnalytics: analyticsGetAnalyticsMock,
  isSupported: analyticsIsSupportedMock,
}));

vi.mock("firebase/app", () => ({
  getApp: appGetAppMock,
  getApps: appGetAppsMock,
  initializeApp: appInitializeAppMock,
}));

vi.mock("firebase/auth", () => ({
  GoogleAuthProvider,
  getAuth: authGetAuthMock,
  onAuthStateChanged: authOnAuthStateChangedMock,
  signInWithEmailAndPassword: authSignInEmailMock,
  signInWithPopup: authSignInPopupMock,
  signOut: authSignOutMock,
}));

vi.mock("firebase/firestore", () => ({
  doc: firestoreDocMock,
  getDoc: firestoreGetDocMock,
  getFirestore: firestoreGetFirestoreMock,
  onSnapshot: firestoreOnSnapshotMock,
  serverTimestamp: firestoreServerTimestampMock,
  setDoc: firestoreSetDocMock,
}));

vi.mock("firebase/app-check", () => ({
  ReCaptchaEnterpriseProvider,
  getToken: appCheckGetTokenMock,
  initializeAppCheck: appCheckInitializeMock,
}));

function setConfiguredFirebaseEnv(
  overrides: Partial<Record<string, string>> = {},
) {
  vi.stubEnv("VITE_FIREBASE_API_KEY", "test-api-key");
  vi.stubEnv("VITE_FIREBASE_AUTH_DOMAIN", "test-project.firebaseapp.com");
  vi.stubEnv("VITE_FIREBASE_PROJECT_ID", "test-project");
  vi.stubEnv("VITE_FIREBASE_STORAGE_BUCKET", "test-project.appspot.com");
  vi.stubEnv("VITE_FIREBASE_MESSAGING_SENDER_ID", "1234567890");
  vi.stubEnv("VITE_FIREBASE_APP_ID", "1:1234567890:web:abcdef123456");
  vi.stubEnv("VITE_FIREBASE_MEASUREMENT_ID", "G-TESTMEASURE");
  vi.stubEnv("VITE_FIREBASE_APPCHECK_SITE_KEY", "test-app-check-site-key");
  vi.stubEnv("VITE_FIREBASE_APPCHECK_DEBUG_TOKEN", "true");

  for (const [key, value] of Object.entries(overrides)) {
    vi.stubEnv(key, value);
  }
}

async function loadFirebaseModule() {
  return import("./firebase");
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.unstubAllEnvs();

  appGetAppsMock.mockReturnValue([]);
  appInitializeAppMock.mockReturnValue(appInstance);
  appGetAppMock.mockReturnValue(appInstance);

  authInstance.currentUser = null;
  authGetAuthMock.mockReturnValue(authInstance);
  authOnAuthStateChangedMock.mockImplementation(
    (_auth: unknown, onChange: (user: AuthUserLike | null) => void) => {
      onChange(null);
      return () => {};
    },
  );
  authSignInEmailMock.mockResolvedValue(undefined);
  authSignInPopupMock.mockResolvedValue(undefined);
  authSignOutMock.mockResolvedValue(undefined);

  firestoreGetFirestoreMock.mockReturnValue({ id: "mock-firestore" });
  firestoreDocMock.mockImplementation(
    (_store: unknown, collection: string, id: string) => ({
      path: `${collection}/${id}`,
    }),
  );
  firestoreGetDocMock.mockResolvedValue({
    data: () => undefined,
    exists: () => false,
  });
  firestoreOnSnapshotMock.mockImplementation(
    (
      _docRef: unknown,
      _onData: (snapshot: SnapshotLike) => void,
      _onError: (error: Error) => void,
    ) => {
      return () => {};
    },
  );
  firestoreServerTimestampMock.mockReturnValue("mock-server-timestamp");
  firestoreSetDocMock.mockResolvedValue(undefined);

  analyticsIsSupportedMock.mockResolvedValue(false);
  analyticsGetAnalyticsMock.mockReturnValue(undefined);

  appCheckInitializeMock.mockReturnValue({ id: "mock-app-check" });
  appCheckGetTokenMock.mockResolvedValue({ token: "app-check-token" });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("firebase module with configured credentials", () => {
  it("initializes firebase services when required env is present", async () => {
    setConfiguredFirebaseEnv();
    const firebaseModule = await loadFirebaseModule();

    expect(firebaseModule.hasFirebaseConfig).toBe(true);
    expect(appInitializeAppMock).toHaveBeenCalledTimes(1);
    expect(authGetAuthMock).toHaveBeenCalledWith(appInstance);
    expect(firestoreGetFirestoreMock).toHaveBeenCalledWith(appInstance);
    expect(firestoreDocMock).toHaveBeenCalledWith(
      expect.anything(),
      "venue-live-state",
      "demoVenue",
    );
  });

  it("returns operator id token from the active firebase user", async () => {
    setConfiguredFirebaseEnv();
    const getIdTokenMock = vi.fn(async () => "firebase-id-token");
    authInstance.currentUser = {
      getIdToken: getIdTokenMock,
    };

    const { getOperatorIdToken } = await loadFirebaseModule();

    await expect(getOperatorIdToken()).resolves.toBe("firebase-id-token");
    expect(getIdTokenMock).toHaveBeenCalledTimes(1);
  });

  it("proxies operator auth actions to firebase auth SDK", async () => {
    setConfiguredFirebaseEnv();
    authOnAuthStateChangedMock.mockImplementation(
      (_auth: unknown, onChange: (user: AuthUserLike | null) => void) => {
        onChange({
          email: "operator@example.com",
          uid: "operator-1",
        });
        return () => {};
      },
    );

    const {
      signInOperator,
      signInOperatorWithGoogle,
      signOutOperator,
      subscribeToOperatorSession,
    } = await loadFirebaseModule();

    const onChange = vi.fn();
    const unsubscribe = subscribeToOperatorSession(onChange);

    expect(onChange).toHaveBeenCalledWith({
      email: "operator@example.com",
      uid: "operator-1",
    });
    expect(typeof unsubscribe).toBe("function");

    await signInOperator("operator@example.com", "secret");
    expect(authSignInEmailMock).toHaveBeenCalledWith(
      authInstance,
      "operator@example.com",
      "secret",
    );

    await signInOperatorWithGoogle();
    expect(googleAuthProviderCtorMock).toHaveBeenCalledTimes(1);
    expect(authSignInPopupMock).toHaveBeenCalledWith(
      authInstance,
      expect.any(GoogleAuthProvider),
    );

    await signOutOperator();
    expect(authSignOutMock).toHaveBeenCalledWith(authInstance);
  });

  it("loads and returns App Check token when site key is configured", async () => {
    setConfiguredFirebaseEnv();
    const { getAppCheckToken } = await loadFirebaseModule();

    await expect(getAppCheckToken()).resolves.toBe("app-check-token");
    expect(recaptchaProviderCtorMock).toHaveBeenCalledWith(
      "test-app-check-site-key",
    );
    expect(appCheckInitializeMock).toHaveBeenCalledTimes(1);
    expect(appCheckGetTokenMock).toHaveBeenCalled();
  });

  it("reads live venue snapshot and writes updates through firestore", async () => {
    setConfiguredFirebaseEnv();

    firestoreGetDocMock.mockResolvedValueOnce({
      data: () => ({
        states: [
          {
            crowdPenalty: 2,
            nodeId: "stall-b",
            queueMinutes: 7,
            queueTrendAfterFiveMinutes: -1,
            serviceMinutesPerAdditionalPerson: 2,
          },
        ],
        updatedAt: "now",
        updatedBy: "operator-1",
        venueId: "demoVenue",
      }),
      exists: () => true,
    });

    const { getFirebaseLiveVenueStateSnapshot, setFirebaseLiveVenueState } =
      await loadFirebaseModule();

    const snapshot = await getFirebaseLiveVenueStateSnapshot();

    expect(snapshot).toMatchObject({
      source: "firebase-live",
      updatedBy: "operator-1",
      venueId: "demoVenue",
    });
    expect(snapshot?.states).toHaveLength(1);

    await setFirebaseLiveVenueState(
      [
        {
          crowdPenalty: 1,
          nodeId: "stall-d",
          queueMinutes: 4,
          queueTrendAfterFiveMinutes: 0,
          serviceMinutesPerAdditionalPerson: 1,
        },
      ],
      {
        updatedBy: "operator-2",
      },
    );

    expect(firestoreServerTimestampMock).toHaveBeenCalledTimes(1);
    expect(firestoreSetDocMock).toHaveBeenCalledWith(
      expect.objectContaining({ path: "venue-live-state/demoVenue" }),
      expect.objectContaining({
        source: "firebase-live",
        updatedBy: "operator-2",
        venueId: "demoVenue",
      }),
    );
  });

  it("falls back to legacy operator-state document when live doc is missing", async () => {
    setConfiguredFirebaseEnv();

    firestoreGetDocMock
      .mockResolvedValueOnce({
        data: () => undefined,
        exists: () => false,
      })
      .mockResolvedValueOnce({
        data: () => ({
          states: [
            {
              crowdPenalty: 1,
              nodeId: "stall-b",
              queueMinutes: 5,
              queueTrendAfterFiveMinutes: -1,
              serviceMinutesPerAdditionalPerson: 2,
            },
          ],
          updatedAt: "legacy-time",
          updatedBy: "legacy-operator",
        }),
        exists: () => true,
      });

    const { getFirebaseLiveVenueStateSnapshot } = await loadFirebaseModule();
    const snapshot = await getFirebaseLiveVenueStateSnapshot();

    expect(snapshot).toMatchObject({
      source: "firebase-live",
      updatedBy: "legacy-operator",
      venueId: "demoVenue",
    });
    expect(snapshot?.states).toHaveLength(1);
  });

  it("subscribes to live venue state snapshots via firestore listener", async () => {
    setConfiguredFirebaseEnv();

    firestoreOnSnapshotMock.mockImplementation(
      (
        _docRef: unknown,
        onData: (snapshot: SnapshotLike) => void,
        _onError: (error: Error) => void,
      ) => {
        onData({
          data: () => ({
            states: [
              {
                crowdPenalty: 3,
                nodeId: "stall-c",
                queueMinutes: 9,
                queueTrendAfterFiveMinutes: 1,
                serviceMinutesPerAdditionalPerson: 2,
              },
            ],
            updatedAt: "stream-time",
            updatedBy: "stream-operator",
            venueId: "demoVenue",
          }),
          exists: () => true,
        });

        return () => {};
      },
    );

    const { subscribeToFirebaseLiveVenueState } = await loadFirebaseModule();
    const onData = vi.fn();
    const onError = vi.fn();

    const unsubscribe = subscribeToFirebaseLiveVenueState(onData, onError);

    expect(onData).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "firebase-live",
        updatedBy: "stream-operator",
        venueId: "demoVenue",
      }),
    );
    expect(typeof unsubscribe).toBe("function");
  });

  it("enables analytics only when browser support is available", async () => {
    setConfiguredFirebaseEnv({
      VITE_FIREBASE_MEASUREMENT_ID: "G-ANALYTICS",
    });
    analyticsIsSupportedMock.mockResolvedValue(true);

    await loadFirebaseModule();
    await Promise.resolve();

    expect(analyticsGetAnalyticsMock).toHaveBeenCalledWith(appInstance);
  });
});
