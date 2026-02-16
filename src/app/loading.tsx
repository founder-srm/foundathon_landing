export default function AppLoading() {
  return (
    <main className="min-h-screen bg-gray-200 text-foreground">
      <div className="fncontainer flex min-h-[70vh] items-center justify-center py-20">
        <div className="flex items-center gap-3 rounded-xl border border-fnblue/25 bg-background/95 px-5 py-3 shadow-md">
          <span
            aria-hidden="true"
            className="size-4 animate-spin rounded-full border-2 border-fnblue/30 border-t-fnblue"
          />
          <p className="text-sm font-bold uppercase tracking-[0.12em] text-fnblue">
            Loading Page
          </p>
        </div>
      </div>
    </main>
  );
}
