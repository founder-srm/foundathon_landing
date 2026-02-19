"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { FnButton } from "@/components/ui/fn-button";
import SignInRequiredModal from "@/components/ui/sign-in-required-modal";
import { springOptions } from "@/lib/constants";
import { Magnetic } from "../ui/magnetic";

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
        <Magnetic
          intensity={0.1}
          springOptions={springOptions}
          actionArea="global"
          range={200}
        >
          <FnButton asChild tone="red" size="lg">
            <Link href={`/dashboard/${initialTeamId}`} prefetch={true}>
              <Magnetic
                intensity={0.05}
                springOptions={springOptions}
                actionArea="global"
                range={200}
              >
                <span className="text-nowrap flex gap-2 items-center">
                  Dashboard
                  <ArrowRight />
                </span>
              </Magnetic>
            </Link>
          </FnButton>
        </Magnetic>
      ) : initialIsSignedIn ? (
        <FnButton asChild tone="red" size="lg">
          <Link href="/register" prefetch={true}>
            {label}
            <ArrowRight />
          </Link>
        </FnButton>
      ) : (
        <Magnetic
          intensity={0.1}
          springOptions={springOptions}
          actionArea="global"
          range={200}
        >
          <FnButton
            type="button"
            tone="red"
            size="lg"
            onClick={() => {
              setShowSignInPrompt(true);
            }}
          >
            <Magnetic
              intensity={0.05}
              springOptions={springOptions}
              actionArea="global"
              range={200}
            >
              {label}
            </Magnetic>
            <ArrowRight />
          </FnButton>
        </Magnetic>
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
