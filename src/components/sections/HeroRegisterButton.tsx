"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { FnButton } from "@/components/ui/fn-button";
import SignInRequiredModal from "@/components/ui/sign-in-required-modal";

type HeroRegisterButtonProps = {
  initialIsSignedIn: boolean;
  initialTeamId: string | null;
  label: string;
};

const HeroRegisterButton = ({
  initialIsSignedIn,
  initialTeamId,
  label,
}: HeroRegisterButtonProps) => {
  const [showSignInPrompt, setShowSignInPrompt] = useState(false);
  const isRegistered = Boolean(initialTeamId);
  const signInToRegisterHref = useMemo(
    () => `/api/auth/login?next=${encodeURIComponent("/register")}`,
    [],
  );

  return (
    <>
      {isRegistered ? (
        <FnButton asChild tone="red" size="lg">
          <Link href={`/team/${initialTeamId}`} prefetch={true}>
            Dashboard
            <ArrowRight />
          </Link>
        </FnButton>
      ) : initialIsSignedIn ? (
        <FnButton asChild tone="red" size="lg">
          <Link href="/register" prefetch={true}>
            {label}
            <ArrowRight />
          </Link>
        </FnButton>
      ) : (
        <FnButton
          type="button"
          tone="red"
          size="lg"
          onClick={() => {
            setShowSignInPrompt(true);
          }}
        >
          {label}
          <ArrowRight />
        </FnButton>
      )}

      <SignInRequiredModal
        open={showSignInPrompt}
        onOpenChange={setShowSignInPrompt}
        signInHref={signInToRegisterHref}
      />
    </>
  );
};

export default HeroRegisterButton;
