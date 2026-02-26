import { render, screen } from "@testing-library/react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InView } from "./in-view";

const mocks = vi.hoisted(() => ({
  resolved: "normal" as "normal" | "reduced",
  useInView: vi.fn(() => true),
}));

vi.mock("motion/react", () => ({
  motion: new Proxy(
    {},
    {
      get:
        () =>
        ({
          animate: _animate,
          children,
          initial: _initial,
          onAnimationComplete: _onAnimationComplete,
          transition: _transition,
          variants: _variants,
          ...props
        }: ComponentPropsWithoutRef<"div"> &
          Record<string, unknown> & { children: ReactNode }) => (
          <div {...props}>{children}</div>
        ),
    },
  ),
  useInView: () => mocks.useInView(),
}));

vi.mock("./motion-preferences", () => ({
  useMotionPreferences: () => ({
    resolved: mocks.resolved,
  }),
}));

describe("InView", () => {
  beforeEach(() => {
    mocks.resolved = "normal";
    mocks.useInView.mockReturnValue(true);
  });

  it("renders static content without motion state in reduced mode", () => {
    mocks.resolved = "reduced";

    render(
      <InView>
        <p>Section body</p>
      </InView>,
    );

    expect(screen.getByText("Section body")).toBeInTheDocument();
    expect(
      document.querySelector('[data-inview-mode="static"]'),
    ).not.toBeNull();
    expect(document.querySelector('[data-inview-mode="motion"]')).toBeNull();
  });

  it("keeps motion mode in normal preference", () => {
    render(
      <InView>
        <p>Section body</p>
      </InView>,
    );

    expect(screen.getByText("Section body")).toBeInTheDocument();
    expect(
      document.querySelector('[data-inview-mode="motion"]'),
    ).not.toBeNull();
  });
});
