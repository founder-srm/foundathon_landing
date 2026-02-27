import Link from "next/link";
import { FnButton } from "@/components/ui/fn-button";
import { InView } from "@/components/ui/in-view";
import {
  AUTH_ERROR_REASON_SRM_BLOCKED,
  BLOCKED_LOGIN_EMAIL_DOMAIN,
} from "@/server/auth/email-policy";

type AuthCodeErrorPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const toSingleSearchParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export default async function AuthCodeErrorPage({
  searchParams,
}: AuthCodeErrorPageProps) {
  const params = await searchParams;
  const reason = toSingleSearchParam(params.reason);
  const isSrmLoginBlocked = reason === AUTH_ERROR_REASON_SRM_BLOCKED;

  return (
    <main className="min-h-screen bg-gray-200 text-foreground relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-45 pointer-events-none"
        style={{ backgroundImage: "url(/textures/circle-16px.svg)" }}
      />
      <div className="fncontainer relative py-16 md:py-24">
        <InView
          once
          transition={{ duration: 0.28, ease: "easeOut" }}
          variants={{
            hidden: { opacity: 0, y: 24, filter: "blur(4px)" },
            visible: { opacity: 1, y: 0, filter: "blur(0px)" },
          }}
        >
          <section className="mx-auto max-w-2xl rounded-2xl border border-b-4 border-fnred bg-background/95 p-8 shadow-xl">
            <p className="inline-flex rounded-full border border-fnred bg-fnred/20 px-3 text-xs font-bold uppercase tracking-wider text-fnred">
              Authentication Error
            </p>
            <h1 className="mt-4 text-3xl font-black uppercase tracking-tight md:text-4xl">
              sign in could not be completed
            </h1>
            <p className="mt-6 text-sm text-foreground/80 font-medium md:text-base">
              {isSrmLoginBlocked
                ? `${BLOCKED_LOGIN_EMAIL_DOMAIN} accounts are not allowed for login. Please use a personal/non-SRM email to sign in.`
                : "We could not complete your login session. Please try signing in again. If this keeps happening, clear browser cookies for this site and retry."}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <InView
                once
                transition={{ duration: 0.2, ease: "easeOut", delay: 0.06 }}
                variants={{
                  hidden: { opacity: 0, y: 12 },
                  visible: { opacity: 1, y: 0 },
                }}
              >
                <FnButton asChild>
                  <Link href="/api/auth/login">Try Sign In Again</Link>
                </FnButton>
              </InView>
              <InView
                once
                transition={{ duration: 0.2, ease: "easeOut", delay: 0.1 }}
                variants={{
                  hidden: { opacity: 0, y: 12 },
                  visible: { opacity: 1, y: 0 },
                }}
              >
                <FnButton asChild tone="gray">
                  <Link href="/">Back to Home</Link>
                </FnButton>
              </InView>
            </div>
          </section>
        </InView>
      </div>
    </main>
  );
}
