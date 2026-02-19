"use client";

import Link from "next/link";
import { useEffect } from "react";
import { FnButton } from "@/components/ui/fn-button";

type SignInRequiredModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  signInHref: string;
};

const SignInRequiredModal = ({
  open,
  onOpenChange,
  signInHref,
}: SignInRequiredModalProps) => {
  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onOpenChange, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sign-in-required-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-b-4 border-fnblue bg-background p-6 shadow-2xl">
        <p
          id="sign-in-required-title"
          className="text-sm font-bold uppercase tracking-[0.18em] text-fnblue"
        >
          Sign In Required
        </p>
        <p className="mt-3 text-sm text-foreground/80">
          Please sign in to register your team for Foundathon.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <FnButton
            type="button"
            onClick={() => onOpenChange(false)}
            tone="gray"
            size="sm"
          >
            Cancel
          </FnButton>
          <FnButton asChild tone="yellow" size="sm">
            <Link href={signInHref}>Sign In</Link>
          </FnButton>
        </div>
      </div>
    </div>
  );
};

export default SignInRequiredModal;
