const LoadingBlock = ({ className }: { className?: string }) => (
  <div
    className={`animate-pulse rounded-md bg-foreground/10 ${
      className ?? "h-4 w-full"
    }`}
  />
);

export default function RegisterLoading() {
  return (
    <main className="min-h-screen bg-gray-200 text-foreground relative overflow-hidden">
      <div className="absolute inset-0 opacity-45 pointer-events-none" />
      <div className="fncontainer relative py-10 md:py-14">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-2xl border border-b-4 border-fnblue bg-background/95 p-6 md:p-8 shadow-lg">
            <LoadingBlock className="h-8 w-56" />
            <LoadingBlock className="mt-3 h-4 w-72" />
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <LoadingBlock className="h-12" />
              <LoadingBlock className="h-12" />
              <LoadingBlock className="h-12" />
              <LoadingBlock className="h-12" />
            </div>
            <div className="mt-6 space-y-4">
              <LoadingBlock className="h-24" />
              <LoadingBlock className="h-24" />
              <LoadingBlock className="h-24" />
            </div>
            <div className="mt-6 flex gap-3">
              <LoadingBlock className="h-10 w-24" />
              <LoadingBlock className="h-10 w-32" />
            </div>
          </section>

          <aside className="space-y-4 self-start">
            <div className="rounded-2xl border border-b-4 border-fnyellow bg-background/95 p-6 shadow-md">
              <LoadingBlock className="h-5 w-36" />
              <div className="mt-4 space-y-3">
                <LoadingBlock className="h-12" />
                <LoadingBlock className="h-12" />
                <LoadingBlock className="h-12" />
              </div>
            </div>
            <div className="rounded-2xl border border-b-4 border-fnblue bg-background/95 p-6 shadow-md">
              <LoadingBlock className="h-5 w-44" />
              <div className="mt-4 space-y-2">
                <LoadingBlock className="h-9" />
                <LoadingBlock className="h-9" />
                <LoadingBlock className="h-9" />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
