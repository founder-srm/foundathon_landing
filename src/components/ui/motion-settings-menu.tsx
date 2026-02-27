"use client";

import { Check, SlidersHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { FnButton } from "./fn-button";
import { useMotionPreferences } from "./motion-preferences";

type MotionSettingsMenuProps = {
  variant?: "desktop" | "mobile";
  className?: string;
  onAction?: () => void;
};

const MotionSettingsMenu = ({
  variant = "desktop",
  className,
  onAction,
}: MotionSettingsMenuProps) => {
  const {
    cursorPreference,
    preference,
    resolved,
    toggleCursor,
    toggleReduced,
  } = useMotionPreferences();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const isReducedEnabled = preference === "reduced";
  const isReducedMode = resolved === "reduced";
  const isCursorEnabled = cursorPreference === "enabled";
  const canToggleCursor = !isReducedMode;

  useEffect(() => {
    if (!isOpen || variant !== "desktop") {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, variant]);

  if (variant === "mobile") {
    return (
      <div className={cn("space-y-2", className)}>
        <button
          type="button"
          className={cn(
            "flex w-full items-center justify-between rounded-md border border-foreground/20 bg-background px-3 py-2 text-sm font-semibold transition-colors hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fnblue/45",
          )}
          aria-label="Toggle reduced motion"
          aria-pressed={isReducedEnabled}
          onClick={() => {
            toggleReduced();
            onAction?.();
          }}
        >
          <span className="inline-flex items-center gap-2">
            <SlidersHorizontal size={16} strokeWidth={2.4} />
            Reduce Motion
          </span>
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em]",
              isReducedEnabled
                ? "border-fnblue/45 bg-fnblue/15 text-fnblue"
                : "border-foreground/20 bg-background text-foreground/70",
            )}
          >
            {isReducedEnabled ? "On" : "Off"}
          </span>
        </button>

        <button
          type="button"
          className={cn(
            "flex w-full items-center justify-between rounded-md border border-foreground/20 bg-background px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fnblue/45",
            canToggleCursor ? "hover:bg-foreground/5" : "opacity-60",
          )}
          aria-label="Toggle custom cursor"
          aria-pressed={isCursorEnabled}
          disabled={!canToggleCursor}
          onClick={() => {
            toggleCursor();
            onAction?.();
          }}
        >
          <span className="inline-flex items-center gap-2">Custom Cursor</span>
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em]",
              isCursorEnabled
                ? "border-fnorange/45 bg-fnorange/15 text-fnorange"
                : "border-foreground/20 bg-background text-foreground/70",
            )}
          >
            {isCursorEnabled ? "On" : "Off"}
          </span>
        </button>
        {isReducedMode ? (
          <p className="text-xs text-foreground/70">
            Custom cursor is disabled while Reduce Motion is on.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn("relative", className)} ref={menuRef}>
      <FnButton
        type="button"
        tone="gray"
        aria-label="Open motion settings"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((previousState) => !previousState)}
      >
        <SlidersHorizontal size={16} strokeWidth={2.4} />
      </FnButton>

      {isOpen ? (
        <div
          role="menu"
          aria-label="Motion settings"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-60 min-w-64 rounded-xl border border-foreground/15 bg-background p-3 shadow-lg"
        >
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-foreground/65">
            Accessibility
          </p>
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={isReducedEnabled}
            className="mt-2 flex w-full items-center justify-between rounded-md border border-foreground/15 px-3 py-2 text-left text-sm font-semibold transition-colors hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fnblue/45"
            onClick={() => {
              toggleReduced();
            }}
          >
            <span>Reduce Motion</span>
            {isReducedEnabled ? (
              <Check size={16} strokeWidth={2.8} className="text-fnblue" />
            ) : (
              <span className="text-xs text-foreground/65">Off</span>
            )}
          </button>
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={isCursorEnabled}
            className={cn(
              "mt-2 flex w-full items-center justify-between rounded-md border border-foreground/15 px-3 py-2 text-left text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fnorange/45",
              canToggleCursor ? "hover:bg-foreground/5" : "opacity-60",
            )}
            disabled={!canToggleCursor}
            onClick={() => {
              toggleCursor();
            }}
          >
            <span>Custom Cursor</span>
            {isCursorEnabled ? (
              <Check size={16} strokeWidth={2.8} className="text-fnorange" />
            ) : (
              <span className="text-xs text-foreground/65">Off</span>
            )}
          </button>
          {isReducedMode ? (
            <p className="mt-2 text-xs text-foreground/70">
              Custom cursor is disabled while Reduce Motion is on.
            </p>
          ) : null}
          <p className="mt-2 text-xs text-foreground/70">
            Current mode:{" "}
            <span className="font-semibold capitalize">
              {resolved === "reduced" ? "Reduced" : "Normal"}
            </span>
          </p>
        </div>
      ) : null}
    </div>
  );
};

export default MotionSettingsMenu;
