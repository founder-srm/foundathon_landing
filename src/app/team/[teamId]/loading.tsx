const LoadingLine = ({ className }: { className?: string }) => (
  <div
    className={`animate-pulse rounded-md bg-foreground/10 ${
      className ?? "h-4 w-full"
    }`}
  />
);

export default function TeamDashboardLoading() {
  return (
    <main className="min-h-screen bg-gray-200 text-foreground relative overflow-hidden">
      <div className="fncontainer relative py-10 md:py-14">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-2xl border border-b-4 border-fnblue bg-background/95 p-6 md:p-8 shadow-lg">
            <LoadingLine className="h-6 w-40" />
            <LoadingLine className="mt-3 h-4 w-72" />
            <LoadingLine className="mt-6 h-16" />
            <LoadingLine className="mt-4 h-20" />
            <LoadingLine className="mt-4 h-20" />
            <div className="mt-6 flex gap-3">
              <LoadingLine className="h-10 w-28" />
              <LoadingLine className="h-10 w-36" />
              <LoadingLine className="h-10 w-32" />
            </div>
          </section>

          <aside className="space-y-4 self-start">
            <div className="rounded-2xl border border-b-4 border-fnyellow bg-background/95 p-6 shadow-md">
              <LoadingLine className="h-5 w-44" />
              <div className="mt-4 space-y-3">
                <LoadingLine className="h-10" />
                <LoadingLine className="h-10" />
                <LoadingLine className="h-10" />
              </div>
            </div>

            <div className="rounded-2xl border border-b-4 border-fnblue bg-background/95 p-6 shadow-md">
              <LoadingLine className="h-5 w-32" />
              <div className="mt-4 space-y-2">
                <LoadingLine className="h-9" />
                <LoadingLine className="h-9" />
                <LoadingLine className="h-9" />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
