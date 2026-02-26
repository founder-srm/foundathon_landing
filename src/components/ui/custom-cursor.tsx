"use client";

import { motion, useMotionValue, useSpring } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { MOTION_SPRINGS, MOTION_TRANSITIONS } from "@/lib/motion-system";
import { useMotionPreferences } from "./motion-preferences";

type CursorKind = "button" | "default" | "disabled" | "input" | "link";
type CursorKindOverride = CursorKind | "none";

const CURSOR_KIND_OVERRIDES: ReadonlyArray<CursorKindOverride> = [
  "default",
  "link",
  "button",
  "input",
  "none",
];

const resolveCursorKind = (target: EventTarget | null): CursorKind => {
  if (!(target instanceof Element)) {
    return "default";
  }

  const overrideHost = target.closest<HTMLElement>("[data-cursor-kind]");
  const overrideValue = overrideHost?.dataset.cursorKind;
  if (
    overrideValue &&
    CURSOR_KIND_OVERRIDES.includes(overrideValue as CursorKindOverride)
  ) {
    if (overrideValue === "none") {
      return "default";
    }

    return overrideValue as CursorKind;
  }

  if (target.closest(":disabled, [aria-disabled='true']")) {
    return "disabled";
  }

  if (target.closest("input, textarea, [contenteditable='true']")) {
    return "input";
  }

  if (target.closest("a[href], [role='link']")) {
    return "link";
  }

  if (target.closest("button, [role='button']")) {
    return "button";
  }

  return "default";
};

const getShellState = (kind: CursorKind) => {
  switch (kind) {
    case "button":
      return {
        backgroundColor: "rgba(245, 115, 22, 0.08)",
        borderColor: "rgba(245, 115, 22, 0.78)",
        borderWidth: 1.6,
        boxShadow: "0 0 20px rgba(245,115,22,0.26)",
        height: 34,
        width: 34,
      };
    case "disabled":
      return {
        backgroundColor: "rgba(15, 23, 42, 0.04)",
        borderColor: "rgba(100, 116, 139, 0.48)",
        borderWidth: 1.4,
        boxShadow: "none",
        height: 24,
        width: 24,
      };
    case "input":
      return {
        backgroundColor: "rgba(39, 114, 160, 0.88)",
        borderColor: "rgba(39, 114, 160, 0.96)",
        borderWidth: 0,
        boxShadow: "0 0 16px rgba(39,114,160,0.32)",
        height: 24,
        width: 2,
      };
    case "link":
      return {
        backgroundColor: "rgba(39, 114, 160, 0.06)",
        borderColor: "rgba(39, 114, 160, 0.82)",
        borderWidth: 1.6,
        boxShadow: "0 0 18px rgba(39,114,160,0.2)",
        height: 14,
        width: 40,
      };
    default:
      return {
        backgroundColor: "rgba(39, 114, 160, 0.04)",
        borderColor: "rgba(39, 114, 160, 0.64)",
        borderWidth: 1.5,
        boxShadow: "0 0 16px rgba(39,114,160,0.2)",
        height: 28,
        width: 28,
      };
  }
};

export default function CustomCursor() {
  const { isCustomCursorEnabled } = useMotionPreferences();
  const [isPressed, setIsPressed] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [kind, setKind] = useState<CursorKind>("default");

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, MOTION_SPRINGS.cursor);
  const springY = useSpring(y, MOTION_SPRINGS.cursor);

  const shell = useMemo(() => getShellState(kind), [kind]);

  useEffect(() => {
    if (!isCustomCursorEnabled) {
      setIsVisible(false);
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      x.set(event.clientX);
      y.set(event.clientY);
      setIsVisible(true);
      setKind(resolveCursorKind(event.target));
    };

    const handlePointerDown = (event: PointerEvent) => {
      setKind(resolveCursorKind(event.target));
      setIsPressed(true);
    };

    const handlePointerUp = () => {
      setIsPressed(false);
    };

    const hideCursor = () => {
      setIsVisible(false);
      setIsPressed(false);
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerdown", handlePointerDown, { passive: true });
    window.addEventListener("pointerup", handlePointerUp, { passive: true });
    window.addEventListener("pointercancel", hideCursor, { passive: true });
    window.addEventListener("blur", hideCursor);
    document.addEventListener("mouseleave", hideCursor);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", hideCursor);
      window.removeEventListener("blur", hideCursor);
      document.removeEventListener("mouseleave", hideCursor);
    };
  }, [isCustomCursorEnabled, x, y]);

  if (!isCustomCursorEnabled) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[120]" aria-hidden="true">
      <motion.div
        data-cursor-layer="shell"
        data-cursor-kind={kind}
        style={{
          x: springX,
          y: springY,
        }}
        animate={{
          backgroundColor: shell.backgroundColor,
          borderColor: shell.borderColor,
          borderRadius: kind === "button" ? 11 : 999,
          borderWidth: shell.borderWidth,
          boxShadow: shell.boxShadow,
          height: shell.height,
          opacity: isVisible ? (kind === "disabled" ? 0.45 : 1) : 0,
          scale: isVisible ? (isPressed ? 0.86 : 1) : 0.7,
          width: shell.width,
        }}
        transition={MOTION_TRANSITIONS.fast}
        className="fixed left-0 top-0 -translate-x-1/2 -translate-y-1/2 border border-solid"
      />
      <motion.div
        data-cursor-layer="dot"
        style={{
          x: springX,
          y: springY,
        }}
        animate={{
          opacity: isVisible && kind !== "input" ? 1 : 0,
          scale: isVisible ? (isPressed ? 0.7 : 1) : 0.6,
        }}
        transition={MOTION_TRANSITIONS.fast}
        className="fixed left-0 top-0 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fnorange shadow-[0_0_12px_rgba(245,115,22,0.55)]"
      />
    </div>
  );
}
