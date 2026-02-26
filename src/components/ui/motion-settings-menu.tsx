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
  const { preference, resolved, toggleReduced } = useMotionPreferences();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const isReducedEnabled = preference === "reduced";

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
      <button
        type="button"
        className={cn(
          "flex w-full items-center justify-between rounded-md border border-foreground/20 bg-background px-3 py-2 text-sm font-semibold transition-colors hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fnblue/45",
          className,
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
