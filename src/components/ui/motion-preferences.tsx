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
export type CursorPreference = "disabled" | "enabled";

export const MOTION_PREFERENCE_STORAGE_KEY = "foundathon:motion-preference";
export const CURSOR_PREFERENCE_STORAGE_KEY = "foundathon:cursor-preference";
const REDUCED_MOTION_MEDIA_QUERY = "(prefers-reduced-motion: reduce)";
const FINE_POINTER_MEDIA_QUERY = "(hover: hover) and (pointer: fine)";

type MotionPreferencesContextValue = {
  cursorPreference: CursorPreference;
  isCustomCursorEnabled: boolean;
  preference: MotionPreference;
  resolved: ResolvedMotionPreference;
  setCursorPreference: (next: CursorPreference) => void;
  setPreference: (next: MotionPreference) => void;
  toggleCursor: () => void;
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

const readStoredCursorPreference = (): CursorPreference => {
  if (typeof window === "undefined") {
    return "enabled";
  }

  const storedPreference = window.localStorage.getItem(
    CURSOR_PREFERENCE_STORAGE_KEY,
  );
  return storedPreference === "disabled" ? "disabled" : "enabled";
};

export const MotionPreferencesProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [preference, setPreference] = useState<MotionPreference>("system");
  const [cursorPreference, setCursorPreference] =
    useState<CursorPreference>("enabled");
  const [osPrefersReducedMotion, setOsPrefersReducedMotion] = useState(false);
  const [hasFinePointer, setHasFinePointer] = useState(false);

  useEffect(() => {
    setPreference(readStoredMotionPreference());
    setCursorPreference(readStoredCursorPreference());
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

    const mediaQueryList = window.matchMedia(FINE_POINTER_MEDIA_QUERY);
    setHasFinePointer(mediaQueryList.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setHasFinePointer(event.matches);
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

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (cursorPreference === "enabled") {
      window.localStorage.removeItem(CURSOR_PREFERENCE_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(CURSOR_PREFERENCE_STORAGE_KEY, cursorPreference);
  }, [cursorPreference]);

  const resolved = useMemo(
    () =>
      resolveMotionPreference({
        osPrefersReducedMotion,
        preference,
      }),
    [osPrefersReducedMotion, preference],
  );

  const isCustomCursorEnabled = useMemo(
    () =>
      cursorPreference === "enabled" &&
      resolved === "normal" &&
      hasFinePointer,
    [cursorPreference, hasFinePointer, resolved],
  );

  useEffect(() => {
    document.documentElement.dataset.motion = resolved;
  }, [resolved]);

  useEffect(() => {
    document.documentElement.dataset.cursor = isCustomCursorEnabled
      ? "custom"
      : "native";
  }, [isCustomCursorEnabled]);

  const toggleReduced = useCallback(() => {
    setPreference((previousPreference) =>
      previousPreference === "reduced" ? "system" : "reduced",
    );
  }, []);

  const toggleCursor = useCallback(() => {
    setCursorPreference((previousPreference) =>
      previousPreference === "enabled" ? "disabled" : "enabled",
    );
  }, []);

  const contextValue = useMemo<MotionPreferencesContextValue>(
    () => ({
      cursorPreference,
      isCustomCursorEnabled,
      preference,
      resolved,
      setCursorPreference,
      setPreference,
      toggleCursor,
      toggleReduced,
    }),
    [
      cursorPreference,
      isCustomCursorEnabled,
      preference,
      resolved,
      toggleCursor,
      toggleReduced,
    ],
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
