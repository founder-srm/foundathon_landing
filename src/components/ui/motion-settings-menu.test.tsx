import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MOTION_PREFERENCE_STORAGE_KEY,
  MotionPreferencesProvider,
} from "./motion-preferences";
import MotionSettingsMenu from "./motion-settings-menu";

const setupMatchMedia = (initialMatches: boolean) => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: initialMatches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
    writable: true,
  });
};

describe("MotionSettingsMenu", () => {
  beforeEach(() => {
    setupMatchMedia(false);
    window.localStorage.clear();
  });

  it("exposes desktop and mobile controls and persists toggle state", async () => {
    const user = userEvent.setup();

    render(
      <MotionPreferencesProvider>
        <MotionSettingsMenu variant="desktop" />
        <MotionSettingsMenu variant="mobile" />
      </MotionPreferencesProvider>,
    );

    const desktopTrigger = screen.getByRole("button", {
      name: /open motion settings/i,
    });
    const mobileToggle = screen.getByRole("button", {
      name: /toggle reduced motion/i,
    });

    expect(desktopTrigger).toBeInTheDocument();
    expect(mobileToggle).toHaveAttribute("aria-pressed", "false");

    await user.click(desktopTrigger);

    const reduceMotionItem = await screen.findByRole("menuitemcheckbox", {
      name: /reduce motion/i,
    });

    await user.click(reduceMotionItem);

    await waitFor(() =>
      expect(window.localStorage.getItem(MOTION_PREFERENCE_STORAGE_KEY)).toBe(
        "reduced",
      ),
    );
    expect(reduceMotionItem).toHaveAttribute("aria-checked", "true");
    expect(mobileToggle).toHaveAttribute("aria-pressed", "true");

    await user.click(mobileToggle);

    await waitFor(() =>
      expect(window.localStorage.getItem(MOTION_PREFERENCE_STORAGE_KEY)).toBe(
        null,
      ),
    );
    expect(mobileToggle).toHaveAttribute("aria-pressed", "false");
  });
});
