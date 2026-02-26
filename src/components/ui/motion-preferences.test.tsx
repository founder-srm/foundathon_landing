import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CURSOR_PREFERENCE_STORAGE_KEY,
  MOTION_PREFERENCE_STORAGE_KEY,
  MotionPreferencesProvider,
  useMotionPreferences,
} from "./motion-preferences";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const FINE_POINTER_QUERY = "(hover: hover) and (pointer: fine)";

const setupMatchMedia = ({
  finePointer = true,
  reducedMotion = false,
}: {
  finePointer?: boolean;
  reducedMotion?: boolean;
}) => {
  let reduced = reducedMotion;
  let fine = finePointer;
  const listeners = {
    fine: new Set<(event: MediaQueryListEvent) => void>(),
    reduced: new Set<(event: MediaQueryListEvent) => void>(),
  };

  const matchMediaMock = vi.fn().mockImplementation((query: string) => ({
    get matches() {
      if (query === REDUCED_MOTION_QUERY) {
        return reduced;
      }

      if (query === FINE_POINTER_QUERY) {
        return fine;
      }

      return false;
    },
    media: query,
    onchange: null,
    addEventListener: (
      eventName: string,
      listener: (event: MediaQueryListEvent) => void,
    ) => {
      if (eventName === "change") {
        if (query === REDUCED_MOTION_QUERY) {
          listeners.reduced.add(listener);
        }

        if (query === FINE_POINTER_QUERY) {
          listeners.fine.add(listener);
        }
      }
    },
    removeEventListener: (
      eventName: string,
      listener: (event: MediaQueryListEvent) => void,
    ) => {
      if (eventName === "change") {
        listeners.reduced.delete(listener);
        listeners.fine.delete(listener);
      }
    },
    addListener: (listener: (event: MediaQueryListEvent) => void) => {
      if (query === REDUCED_MOTION_QUERY) {
        listeners.reduced.add(listener);
      }

      if (query === FINE_POINTER_QUERY) {
        listeners.fine.add(listener);
      }
    },
    removeListener: (listener: (event: MediaQueryListEvent) => void) => {
      listeners.reduced.delete(listener);
      listeners.fine.delete(listener);
    },
    dispatchEvent: () => true,
  }));

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: matchMediaMock,
    writable: true,
  });

  return {
    setFinePointer: (next: boolean) => {
      fine = next;
      for (const listener of listeners.fine) {
        listener({
          matches: next,
          media: FINE_POINTER_QUERY,
        } as MediaQueryListEvent);
      }
    },
    setReducedMotion: (next: boolean) => {
      reduced = next;
      for (const listener of listeners.reduced) {
        listener({
          matches: next,
          media: REDUCED_MOTION_QUERY,
        } as MediaQueryListEvent);
      }
    },
  };
};

const MotionProbe = () => {
  const {
    cursorPreference,
    isCustomCursorEnabled,
    preference,
    resolved,
    setCursorPreference,
    setPreference,
  } = useMotionPreferences();

  return (
    <div>
      <p data-testid="cursor-preference">{cursorPreference}</p>
      <p data-testid="cursor-resolved">
        {isCustomCursorEnabled ? "custom" : "native"}
      </p>
      <p data-testid="preference">{preference}</p>
      <p data-testid="resolved">{resolved}</p>
      <button type="button" onClick={() => setPreference("reduced")}>
        Force Reduced
      </button>
      <button type="button" onClick={() => setPreference("system")}>
        Follow System
      </button>
      <button type="button" onClick={() => setCursorPreference("disabled")}>
        Disable Cursor
      </button>
      <button type="button" onClick={() => setCursorPreference("enabled")}>
        Enable Cursor
      </button>
    </div>
  );
};

describe("MotionPreferencesProvider", () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.motion;
    delete document.documentElement.dataset.cursor;
  });

  it("resolves motion from system preference and updates dataset", async () => {
    const media = setupMatchMedia({ finePointer: true, reducedMotion: true });

    render(
      <MotionPreferencesProvider>
        <MotionProbe />
      </MotionPreferencesProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("resolved")).toHaveTextContent("reduced"),
    );
    expect(screen.getByTestId("preference")).toHaveTextContent("system");
    expect(document.documentElement.dataset.motion).toBe("reduced");
    expect(document.documentElement.dataset.cursor).toBe("native");

    act(() => {
      media.setReducedMotion(false);
    });

    await waitFor(() =>
      expect(screen.getByTestId("resolved")).toHaveTextContent("normal"),
    );
    expect(document.documentElement.dataset.motion).toBe("normal");
    expect(document.documentElement.dataset.cursor).toBe("custom");
  });

  it("persists manual preference and restores it on remount", async () => {
    setupMatchMedia({ finePointer: true, reducedMotion: false });
    const user = userEvent.setup();

    const view = render(
      <MotionPreferencesProvider>
        <MotionProbe />
      </MotionPreferencesProvider>,
    );

    await user.click(screen.getByRole("button", { name: /force reduced/i }));

    await waitFor(() =>
      expect(window.localStorage.getItem(MOTION_PREFERENCE_STORAGE_KEY)).toBe(
        "reduced",
      ),
    );
    expect(document.documentElement.dataset.motion).toBe("reduced");

    view.unmount();

    render(
      <MotionPreferencesProvider>
        <MotionProbe />
      </MotionPreferencesProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("preference")).toHaveTextContent("reduced"),
    );
    expect(screen.getByTestId("resolved")).toHaveTextContent("reduced");

    await user.click(screen.getByRole("button", { name: /follow system/i }));

    await waitFor(() =>
      expect(window.localStorage.getItem(MOTION_PREFERENCE_STORAGE_KEY)).toBe(
        null,
      ),
    );

    await user.click(screen.getByRole("button", { name: /disable cursor/i }));

    await waitFor(() =>
      expect(window.localStorage.getItem(CURSOR_PREFERENCE_STORAGE_KEY)).toBe(
        "disabled",
      ),
    );
    expect(screen.getByTestId("cursor-preference")).toHaveTextContent(
      "disabled",
    );
    expect(screen.getByTestId("cursor-resolved")).toHaveTextContent("native");
    expect(document.documentElement.dataset.cursor).toBe("native");
  });

  it("keeps native cursor on coarse pointers", async () => {
    const media = setupMatchMedia({ finePointer: true, reducedMotion: false });

    render(
      <MotionPreferencesProvider>
        <MotionProbe />
      </MotionPreferencesProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("cursor-resolved")).toHaveTextContent("custom"),
    );

    act(() => {
      media.setFinePointer(false);
    });

    await waitFor(() =>
      expect(screen.getByTestId("cursor-resolved")).toHaveTextContent("native"),
    );
  });
});
