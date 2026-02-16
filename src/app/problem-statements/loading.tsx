export default function ProblemStatementsLoading() {
  return (
    <main className="min-h-screen bg-gray-200 text-foreground relative overflow-hidden">
      <div className="fncontainer relative py-16 md:py-24">
        <section className="rounded-2xl border border-b-4 border-fnblue bg-background/95 p-8 md:p-10 shadow-2xl">
          <div className="h-5 w-52 animate-pulse rounded-md bg-fnblue/20" />
          <div className="mt-4 h-12 w-80 max-w-full animate-pulse rounded-md bg-foreground/10" />
          <div className="mt-3 h-4 w-96 max-w-full animate-pulse rounded-md bg-foreground/10" />

          <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="h-28 animate-pulse rounded-xl bg-foreground/10" />
            <div className="h-28 animate-pulse rounded-xl bg-foreground/10" />
            <div className="h-28 animate-pulse rounded-xl bg-foreground/10" />
            <div className="h-28 animate-pulse rounded-xl bg-foreground/10" />
          </div>
        </section>
      </div>
    </main>
  );
}
