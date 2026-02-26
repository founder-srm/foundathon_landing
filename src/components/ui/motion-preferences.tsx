"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type MotionPreference = "system" | "reduced";
export type ResolvedMotionPreference = "normal" | "reduced";

export const MOTION_PREFERENCE_STORAGE_KEY = "foundathon:motion-preference";
const REDUCED_MOTION_MEDIA_QUERY = "(prefers-reduced-motion: reduce)";

type MotionPreferencesContextValue = {
  preference: MotionPreference;
  resolved: ResolvedMotionPreference;
  setPreference: (next: MotionPreference) => void;
  toggleReduced: () => void;
};

const MotionPreferencesContext =
  createContext<MotionPreferencesContextValue | null>(null);

const resolveMotionPreference = ({
  osPrefersReducedMotion,
  preference,
}: {
  osPrefersReducedMotion: boolean;
  preference: MotionPreference;
}): ResolvedMotionPreference =>
  preference === "reduced" ||
  (preference === "system" && osPrefersReducedMotion)
    ? "reduced"
    : "normal";

const readStoredMotionPreference = (): MotionPreference => {
  if (typeof window === "undefined") {
    return "system";
  }

  const storedPreference = window.localStorage.getItem(
    MOTION_PREFERENCE_STORAGE_KEY,
  );
  return storedPreference === "reduced" ? "reduced" : "system";
};

export const MotionPreferencesProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [preference, setPreference] = useState<MotionPreference>("system");
  const [osPrefersReducedMotion, setOsPrefersReducedMotion] = useState(false);

  useEffect(() => {
    setPreference(readStoredMotionPreference());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQueryList = window.matchMedia(REDUCED_MOTION_MEDIA_QUERY);
    setOsPrefersReducedMotion(mediaQueryList.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setOsPrefersReducedMotion(event.matches);
    };

    if (typeof mediaQueryList.addEventListener === "function") {
      mediaQueryList.addEventListener("change", handleChange);
      return () => mediaQueryList.removeEventListener("change", handleChange);
    }

    mediaQueryList.addListener(handleChange);
    return () => mediaQueryList.removeListener(handleChange);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (preference === "system") {
      window.localStorage.removeItem(MOTION_PREFERENCE_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(MOTION_PREFERENCE_STORAGE_KEY, preference);
  }, [preference]);

  const resolved = useMemo(
    () =>
      resolveMotionPreference({
        osPrefersReducedMotion,
        preference,
      }),
    [osPrefersReducedMotion, preference],
  );

  useEffect(() => {
    document.documentElement.dataset.motion = resolved;
  }, [resolved]);

  const toggleReduced = useCallback(() => {
    setPreference((previousPreference) =>
      previousPreference === "reduced" ? "system" : "reduced",
    );
  }, []);

  const contextValue = useMemo<MotionPreferencesContextValue>(
    () => ({
      preference,
      resolved,
      setPreference,
      toggleReduced,
    }),
    [preference, resolved, toggleReduced],
  );

  return (
    <MotionPreferencesContext.Provider value={contextValue}>
      {children}
    </MotionPreferencesContext.Provider>
  );
};

export const useMotionPreferences = () => {
  const context = useContext(MotionPreferencesContext);
  if (!context) {
    throw new Error(
      "useMotionPreferences must be used within a MotionPreferencesProvider.",
    );
  }
  return context;
};
