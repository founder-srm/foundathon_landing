import { act, render, waitFor } from "@testing-library/react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CustomCursor from "./custom-cursor";

const mocks = vi.hoisted(() => ({
  isCustomCursorEnabled: false,
}));

vi.mock("motion/react", () => ({
  motion: {
    div: ({
      children,
      ...props
    }: ComponentPropsWithoutRef<"div"> & { children?: ReactNode }) => (
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
    isCustomCursorEnabled: mocks.isCustomCursorEnabled,
  }),
}));

const PointerEventCtor = window.PointerEvent ?? window.MouseEvent;

const dispatchPointerMove = (target: Element) => {
  act(() => {
    target.dispatchEvent(
      new PointerEventCtor("pointermove", {
        bubbles: true,
        clientX: 120,
        clientY: 64,
      }),
    );
  });
};

describe("CustomCursor", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("does not render in native cursor mode", () => {
    mocks.isCustomCursorEnabled = false;
    render(<CustomCursor />);

    expect(document.querySelector('[data-cursor-layer="shell"]')).toBeNull();
  });

  it("renders cursor layers when custom cursor is enabled", () => {
    mocks.isCustomCursorEnabled = true;
    render(<CustomCursor />);

    expect(document.querySelector('[data-cursor-layer="shell"]')).not.toBeNull();
    expect(document.querySelector('[data-cursor-layer="dot"]')).not.toBeNull();
  });

  it("morphs cursor kind based on hovered targets", async () => {
    mocks.isCustomCursorEnabled = true;
    render(<CustomCursor />);

    const shell = document.querySelector(
      '[data-cursor-layer="shell"]',
    ) as HTMLElement;

    const link = document.createElement("a");
    link.href = "#target";
    document.body.appendChild(link);
    dispatchPointerMove(link);
    await waitFor(() => expect(shell.dataset.cursorKind).toBe("link"));

    const button = document.createElement("button");
    document.body.appendChild(button);
    dispatchPointerMove(button);
    await waitFor(() => expect(shell.dataset.cursorKind).toBe("button"));

    const input = document.createElement("input");
    document.body.appendChild(input);
    dispatchPointerMove(input);
    await waitFor(() => expect(shell.dataset.cursorKind).toBe("input"));
  });
});
