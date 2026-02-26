import { render, screen } from "@testing-library/react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RouteTransition } from "./route-transition";

const mocks = vi.hoisted(() => ({
  pathname: "/",
  resolved: "normal" as "normal" | "reduced",
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
}));

vi.mock("motion/react", () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => children,
  motion: {
    div: ({
      children,
      ...props
    }: ComponentPropsWithoutRef<"div"> & { children: ReactNode }) => (
      <div {...props}>{children}</div>
    ),
  },
}));

vi.mock("./motion-preferences", () => ({
  useMotionPreferences: () => ({
    resolved: mocks.resolved,
  }),
}));

describe("RouteTransition", () => {
  beforeEach(() => {
    mocks.pathname = "/";
    mocks.resolved = "normal";
  });

  it("enables animated route container in normal mode", () => {
    render(
      <RouteTransition>
        <main>Dashboard</main>
      </RouteTransition>,
    );

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(
      document.querySelector('[data-route-transition="on"]'),
    ).not.toBeNull();
    expect(document.querySelector('[data-route-transition="off"]')).toBeNull();
  });

  it("renders static route container in reduced mode", () => {
    mocks.resolved = "reduced";

    render(
      <RouteTransition>
        <main>Dashboard</main>
      </RouteTransition>,
    );

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(
      document.querySelector('[data-route-transition="off"]'),
    ).not.toBeNull();
    expect(document.querySelector('[data-route-transition="on"]')).toBeNull();
  });
});
