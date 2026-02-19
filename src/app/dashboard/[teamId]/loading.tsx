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
      <div
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{ backgroundImage: "url(/textures/circle-16px.svg)" }}
      />
      <div className="absolute -top-24 right-0 size-80 rounded-full bg-fnblue/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-12 size-80 rounded-full bg-fnyellow/25 blur-3xl pointer-events-none" />

      <div className="fncontainer relative py-10 md:py-14">
        <div className="h-8 w-56 animate-pulse rounded-md bg-foreground/10" />
        <div className="mt-2 h-4 w-72 animate-pulse rounded-md bg-foreground/10" />

        <section className="mt-6 rounded-2xl border border-b-4 border-fnyellow bg-background/95 p-6 shadow-lg">
          <LoadingLine className="h-4 w-44" />
          <LoadingLine className="mt-3 h-9 w-3/4" />
          <div className="mt-6 grid gap-3 md:grid-cols-4">
            <div className="h-14 animate-pulse rounded-lg bg-foreground/10" />
            <div className="h-14 animate-pulse rounded-lg bg-foreground/10" />
            <div className="h-14 animate-pulse rounded-lg bg-foreground/10" />
            <div className="h-14 animate-pulse rounded-lg bg-foreground/10" />
          </div>
        </section>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="h-24 animate-pulse rounded-xl border border-b-4 border-fnblue bg-background/90" />
          <div className="h-24 animate-pulse rounded-xl border border-b-4 border-fngreen bg-background/90" />
          <div className="h-24 animate-pulse rounded-xl border border-b-4 border-fnorange bg-background/90" />
          <div className="h-24 animate-pulse rounded-xl border border-b-4 border-fnyellow bg-background/90" />
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
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

          <aside className="space-y-4">
            <div className="rounded-2xl border border-b-4 border-fngreen bg-background/95 p-6 shadow-lg">
              <LoadingLine className="h-5 w-44" />
              <div className="mt-4 space-y-3">
                <LoadingLine className="h-10" />
                <LoadingLine className="h-10" />
                <LoadingLine className="h-10" />
              </div>
            </div>

            <div className="rounded-2xl border border-b-4 border-fnyellow bg-background/95 p-6 shadow-lg">
              <LoadingLine className="h-5 w-32" />
              <div className="mt-4 space-y-2">
                <LoadingLine className="h-9" />
                <LoadingLine className="h-9" />
                <LoadingLine className="h-9" />
              </div>
            </div>

            <div className="rounded-2xl border border-b-4 border-fnorange bg-background/95 p-6 shadow-lg">
              <LoadingLine className="h-5 w-24" />
              <LoadingLine className="mt-3 h-4 w-64" />
              <LoadingLine className="mt-4 h-10 w-52" />
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
