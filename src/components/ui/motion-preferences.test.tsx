import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MOTION_PREFERENCE_STORAGE_KEY,
  MotionPreferencesProvider,
  useMotionPreferences,
} from "./motion-preferences";

const setupMatchMedia = (initialMatches: boolean) => {
  let matches = initialMatches;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();

  const matchMediaMock = vi.fn().mockImplementation((query: string) => ({
    get matches() {
      return matches;
    },
    media: query,
    onchange: null,
    addEventListener: (
      eventName: string,
      listener: (event: MediaQueryListEvent) => void,
    ) => {
      if (eventName === "change") {
        listeners.add(listener);
      }
    },
    removeEventListener: (
      eventName: string,
      listener: (event: MediaQueryListEvent) => void,
    ) => {
      if (eventName === "change") {
        listeners.delete(listener);
      }
    },
    addListener: (listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener);
    },
    removeListener: (listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener);
    },
    dispatchEvent: () => true,
  }));

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: matchMediaMock,
    writable: true,
  });

  return {
    setMatches: (next: boolean) => {
      matches = next;
      for (const listener of listeners) {
        listener({
          matches: next,
          media: "(prefers-reduced-motion: reduce)",
        } as MediaQueryListEvent);
      }
    },
  };
};

const MotionProbe = () => {
  const { preference, resolved, setPreference } = useMotionPreferences();

  return (
    <div>
      <p data-testid="preference">{preference}</p>
      <p data-testid="resolved">{resolved}</p>
      <button type="button" onClick={() => setPreference("reduced")}>
        Force Reduced
      </button>
      <button type="button" onClick={() => setPreference("system")}>
        Follow System
      </button>
    </div>
  );
};

describe("MotionPreferencesProvider", () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.motion;
  });

  it("resolves motion from system preference and updates dataset", async () => {
    const media = setupMatchMedia(true);

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

    act(() => {
      media.setMatches(false);
    });

    await waitFor(() =>
      expect(screen.getByTestId("resolved")).toHaveTextContent("normal"),
    );
    expect(document.documentElement.dataset.motion).toBe("normal");
  });

  it("persists manual preference and restores it on remount", async () => {
    setupMatchMedia(false);
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
  });
});
