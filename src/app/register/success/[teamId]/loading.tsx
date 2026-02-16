const LoadingPanel = ({ className }: { className?: string }) => (
  <div
    className={`animate-pulse rounded-md bg-foreground/10 ${
      className ?? "h-4 w-full"
    }`}
  />
);

export default function RegisterSuccessLoading() {
  return (
    <main className="min-h-screen bg-gray-200 text-foreground relative overflow-hidden">
      <div className="fncontainer relative py-16 md:py-24">
        <section className="rounded-2xl border border-b-4 border-fngreen bg-background/95 p-8 md:p-10 shadow-xl">
          <LoadingPanel className="h-6 w-64" />
          <LoadingPanel className="mt-4 h-12 w-80" />
          <LoadingPanel className="mt-3 h-4 w-96 max-w-full" />

          <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
            <LoadingPanel className="h-28" />
            <LoadingPanel className="h-28" />
            <LoadingPanel className="h-28" />
            <LoadingPanel className="h-28" />
          </div>

          <div className="mt-6 space-y-4">
            <LoadingPanel className="h-16" />
            <LoadingPanel className="h-16" />
            <LoadingPanel className="h-16" />
          </div>
        </section>
      </div>
    </main>
  );
}
