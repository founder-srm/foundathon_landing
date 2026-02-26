import { render, screen } from "@testing-library/react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { Magnetic } from "./magnetic";

const mocks = vi.hoisted(() => ({
  resolved: "reduced" as "normal" | "reduced",
}));

vi.mock("motion/react", () => ({
  motion: {
    div: ({
      children,
      ...props
    }: ComponentPropsWithoutRef<"div"> & { children: ReactNode }) => (
      <div {...props}>{children}</div>
    ),
  },
  useMotionValue: () => ({
    set: vi.fn(),
  }),
  useSpring: (value: unknown) => value,
}));

vi.mock("./motion-preferences", () => ({
  useMotionPreferences: () => ({
    resolved: mocks.resolved,
  }),
}));

describe("Magnetic", () => {
  it("skips mousemove behavior in reduced mode", () => {
    const addEventListenerSpy = vi.spyOn(document, "addEventListener");

    render(
      <Magnetic>
        <button type="button">Action</button>
      </Magnetic>,
    );

    expect(screen.getByText("Action")).toBeInTheDocument();
    expect(
      document.querySelector('[data-magnetic-mode="static"]'),
    ).not.toBeNull();
    expect(
      addEventListenerSpy.mock.calls.some(
        ([eventName]) => eventName === "mousemove",
      ),
    ).toBe(false);
  });
});
