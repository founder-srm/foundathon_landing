import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CURSOR_PREFERENCE_STORAGE_KEY,
  MOTION_PREFERENCE_STORAGE_KEY,
  MotionPreferencesProvider,
} from "./motion-preferences";
import MotionSettingsMenu from "./motion-settings-menu";

const setupMatchMedia = ({
  finePointer = true,
  reducedMotion = false,
}: {
  finePointer?: boolean;
  reducedMotion?: boolean;
}) => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => {
      const matches =
        query === "(prefers-reduced-motion: reduce)"
          ? reducedMotion
          : query === "(hover: hover) and (pointer: fine)"
            ? finePointer
            : false;

      return {
        matches,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      };
    }),
    writable: true,
  });
};

describe("MotionSettingsMenu", () => {
  beforeEach(() => {
    setupMatchMedia({ finePointer: true, reducedMotion: false });
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
    const mobileMotionToggle = screen.getByRole("button", {
      name: /toggle reduced motion/i,
    });
    const mobileCursorToggle = screen.getByRole("button", {
      name: /toggle custom cursor/i,
    });

    expect(desktopTrigger).toBeInTheDocument();
    expect(mobileMotionToggle).toHaveAttribute("aria-pressed", "false");
    expect(mobileCursorToggle).toHaveAttribute("aria-pressed", "true");

    await user.click(desktopTrigger);

    const reduceMotionItem = await screen.findByRole("menuitemcheckbox", {
      name: /reduce motion/i,
    });
    const customCursorItem = await screen.findByRole("menuitemcheckbox", {
      name: /custom cursor/i,
    });

    await user.click(customCursorItem);

    await waitFor(() =>
      expect(window.localStorage.getItem(CURSOR_PREFERENCE_STORAGE_KEY)).toBe(
        "disabled",
      ),
    );
    expect(customCursorItem).toHaveAttribute("aria-checked", "false");
    expect(mobileCursorToggle).toHaveAttribute("aria-pressed", "false");

    await user.click(reduceMotionItem);

    await waitFor(() =>
      expect(window.localStorage.getItem(MOTION_PREFERENCE_STORAGE_KEY)).toBe(
        "reduced",
      ),
    );
    expect(reduceMotionItem).toHaveAttribute("aria-checked", "true");
    expect(mobileMotionToggle).toHaveAttribute("aria-pressed", "true");
    expect(mobileCursorToggle).toBeDisabled();
    expect(
      screen.getAllByText(
        /custom cursor is disabled while reduce motion is on/i,
      ).length,
    ).toBeGreaterThan(0);

    await user.click(mobileMotionToggle);

    await waitFor(() =>
      expect(window.localStorage.getItem(MOTION_PREFERENCE_STORAGE_KEY)).toBe(
        null,
      ),
    );
    expect(mobileMotionToggle).toHaveAttribute("aria-pressed", "false");
    expect(mobileCursorToggle).not.toBeDisabled();
  });
});
