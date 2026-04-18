import { useCallback, useEffect, useState } from "react";

type DeferredInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function getInitialOfflineState() {
  if (typeof navigator === "undefined") {
    return false;
  }

  return !navigator.onLine;
}

export function useInstallAndConnectivity() {
  const [installPrompt, setInstallPrompt] =
    useState<DeferredInstallPromptEvent | null>(null);
  const [isOffline, setIsOffline] = useState(getInitialOfflineState);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as DeferredInstallPromptEvent);
    };
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handleInstallApp = useCallback(async () => {
    if (!installPrompt) {
      return;
    }

    await installPrompt.prompt();
    await installPrompt.userChoice.catch(() => null);
    setInstallPrompt(null);
  }, [installPrompt]);

  return {
    handleInstallApp,
    installPrompt,
    isOffline,
  };
}

export type { DeferredInstallPromptEvent };
