"use client";

import { LogOut, Menu, User, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FnButton } from "@/components/ui/fn-button";
import { LineShadowText } from "@/components/ui/line-shadow-text";
import SignInRequiredModal from "@/components/ui/sign-in-required-modal";
import {
  isTeamCreatedEventDetail,
  TEAM_CREATED_EVENT,
} from "@/lib/team-ui-events";
import { ConfettiButton } from "../ui/confetti-button";

type HeaderClientProps = {
  initialIsSignedIn: boolean;
  initialTeamId: string | null;
};

const navLinks = [
  { href: "/#overview", label: "Overview" },
  { href: "/#rules", label: "Rules" },
  { href: "/#champion", label: "Goodies" },
];

const HeaderClient = ({
  initialIsSignedIn,
  initialTeamId,
}: HeaderClientProps) => {
  const pathname = usePathname();
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showSignInPrompt, setShowSignInPrompt] = useState(false);
  const [teamId, setTeamId] = useState<string | null>(initialTeamId);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const previousPathnameRef = useRef(pathname);
  const isSignedIn = initialIsSignedIn;
  const isRegistered = Boolean(teamId);
  const signInHref = useMemo(
    () => `/api/auth/login?next=${encodeURIComponent(pathname)}`,
    [pathname],
  );
  const signInToRegisterHref = useMemo(
    () => `/api/auth/login?next=${encodeURIComponent("/register")}`,
    [],
  );

  const handleLogout = useCallback(() => {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);
    setIsAccountMenuOpen(false);
    window.location.assign("/api/auth/logout");
  }, [isLoggingOut]);

  const closeMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(false);
  }, []);

  useEffect(() => {
    setTeamId(initialTeamId);
  }, [initialTeamId]);

  useEffect(() => {
    if (previousPathnameRef.current !== pathname) {
      previousPathnameRef.current = pathname;
      setIsMobileMenuOpen(false);
    }
  }, [pathname]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!isMobileMenuOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    const handleTeamCreated = (event: Event) => {
      const customEvent = event as CustomEvent<unknown>;
      if (!isTeamCreatedEventDetail(customEvent.detail)) {
        return;
      }

      setTeamId(customEvent.detail.teamId);
    };

    window.addEventListener(TEAM_CREATED_EVENT, handleTeamCreated);
    return () =>
      window.removeEventListener(TEAM_CREATED_EVENT, handleTeamCreated);
  }, []);

  useEffect(() => {
    if (!isAccountMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setIsAccountMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsAccountMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isAccountMenuOpen]);

  return (
    <>
      <div className="sticky top-0 z-50 border-b border-foreground/10 bg-background/50 px-3 py-3 font-semibold shadow-sm backdrop-blur-md supports-backdrop-filter:bg-background/50 md:px-4">
        <div className="fncontainer flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <ConfettiButton
              options={{
                get angle() {
                  return Math.floor(Math.random() * 90) + 270;
                },
              }}
              className="bg-transparent hover:bg-transparent"
            >
              <Link
                href="https://www.thefoundersclub.in/"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Image
                  src="/logo.svg"
                  alt="The Founders Club logo"
                  width={36}
                  height={36}
                  className="h-8 w-auto"
                />
              </Link>
            </ConfettiButton>

            <Link
              href="/#hero"
              className="flex min-w-0 items-center gap-2 text-lg font-mono font-extrabold italic uppercase tracking-tight sm:text-xl md:text-3xl"
            >
              <LineShadowText>Foundathon</LineShadowText>
              <LineShadowText>3.0</LineShadowText>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 sm:flex">
              {navLinks.map((item) => (
                <FnButton key={item.href} asChild kind="nav">
                  <Link href={item.href}>{item.label}</Link>
                </FnButton>
              ))}
            </div>

            <FnButton
              type="button"
              tone="gray"
              className="lg:hidden h-10"
              aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={isMobileMenuOpen}
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            >
              {isMobileMenuOpen ? (
                <X size={18} strokeWidth={3} />
              ) : (
                <Menu size={18} strokeWidth={3} />
              )}
            </FnButton>

            <div className="hidden items-center gap-3 lg:flex">
              <FnButton asChild tone="gray">
                <Link href="/problem-statements" prefetch={true}>
                  Problem Statements
                </Link>
              </FnButton>
              {isRegistered ? (
                <FnButton asChild tone="blue">
                  <Link href={`/dashboard/${teamId}`} prefetch={true}>
                    Dashboard
                  </Link>
                </FnButton>
              ) : isSignedIn ? (
                <FnButton asChild tone="blue">
                  <Link href="/register" prefetch={true}>
                    Register Team
                  </Link>
                </FnButton>
              ) : (
                <FnButton
                  type="button"
                  tone="blue"
                  onClick={() => {
                    setShowSignInPrompt(true);
                  }}
                >
                  Register Team
                </FnButton>
              )}
              {isSignedIn ? (
                <div className="relative" ref={accountMenuRef}>
                  <FnButton
                    tone="yellow"
                    type="button"
                    aria-label="Open account menu"
                    aria-expanded={isAccountMenuOpen}
                    aria-haspopup="menu"
                    title="Account"
                    disabled={isLoggingOut}
                    onClick={() => {
                      setIsAccountMenuOpen((prev) => !prev);
                    }}
                  >
                    <User size={20} strokeWidth={3} />
                  </FnButton>
                  {isAccountMenuOpen ? (
                    <div
                      className="absolute right-0 top-[calc(100%+0.5rem)] min-w-40 rounded-md border border-foreground/20 bg-background p-2 shadow-md"
                      role="menu"
                      aria-label="Account menu"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold hover:bg-foreground/10"
                      >
                        <LogOut size={16} />
                        {isLoggingOut ? "Logging out..." : "Logout"}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <FnButton asChild tone="yellow">
                  <Link href={signInHref}>Sign In</Link>
                </FnButton>
              )}
            </div>
          </div>
        </div>
      </div>

      {isMobileMenuOpen ? (
        <div className="border-b space-y-4 border-foreground/10 bg-background/95 px-4 py-3 shadow-sm lg:hidden">
          <div className="fncontainer space-y-2 sm:hidden">
            {navLinks.map((item) => (
              <FnButton key={item.href} asChild kind="nav" className="w-full">
                <Link href={item.href} onClick={closeMobileMenu}>
                  {item.label}
                </Link>
              </FnButton>
            ))}
          </div>
          <div className="fncontainer space-y-2">
            <FnButton asChild tone="gray" className="w-full">
              <Link
                href="/problem-statements"
                prefetch={true}
                onClick={closeMobileMenu}
              >
                Problem Statements
              </Link>
            </FnButton>
            {isRegistered ? (
              <FnButton asChild tone="blue" className="w-full">
                <Link
                  href={`/dashboard/${teamId}`}
                  prefetch={true}
                  onClick={closeMobileMenu}
                >
                  Dashboard
                </Link>
              </FnButton>
            ) : isSignedIn ? (
              <FnButton asChild tone="blue" className="w-full">
                <Link
                  href="/register"
                  prefetch={true}
                  onClick={closeMobileMenu}
                >
                  Register Team
                </Link>
              </FnButton>
            ) : (
              <FnButton
                type="button"
                tone="blue"
                className="w-full"
                onClick={() => {
                  setShowSignInPrompt(true);
                  setIsMobileMenuOpen(false);
                }}
              >
                Register Team
              </FnButton>
            )}
            {isSignedIn ? (
              <FnButton
                type="button"
                tone="yellow"
                className="w-full"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  handleLogout();
                }}
                disabled={isLoggingOut}
              >
                {isLoggingOut ? "Logging out..." : "Logout"}
              </FnButton>
            ) : (
              <FnButton asChild tone="yellow" className="w-full">
                <Link href={signInHref} onClick={closeMobileMenu}>
                  Sign In
                </Link>
              </FnButton>
            )}
          </div>
        </div>
      ) : null}

      <SignInRequiredModal
        open={showSignInPrompt}
        onOpenChange={setShowSignInPrompt}
        signInHref={signInToRegisterHref}
      />
    </>
  );
};

export default HeaderClient;
