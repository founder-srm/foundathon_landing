import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MotionPreferencesProvider } from "@/components/ui/motion-preferences";
import HeaderClient from "./HeaderClient";

const mocks = vi.hoisted(() => ({
  pathname: "/",
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
}));

vi.mock("next/image", () => ({
  default: ({ ...props }: ComponentPropsWithoutRef<"span">) => (
    <span {...props} />
  ),
}));

vi.mock("../ui/confetti-button", () => ({
  ConfettiButton: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("@/components/ui/sign-in-required-modal", () => ({
  __esModule: true,
  default: () => null,
}));

const setupMatchMedia = () => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
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

describe("HeaderClient motion controls", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setupMatchMedia();
  });

  it("shows motion control in desktop and mobile header menus", async () => {
    const user = userEvent.setup();

    render(
      <MotionPreferencesProvider>
        <HeaderClient initialIsSignedIn={false} initialTeamId={null} />
      </MotionPreferencesProvider>,
    );

    expect(
      screen.getByRole("button", {
        name: /open motion settings/i,
      }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: /open menu/i,
      }),
    );

    expect(
      screen.getByRole("button", { name: /toggle reduced motion/i }),
    ).toBeInTheDocument();
  });
});
