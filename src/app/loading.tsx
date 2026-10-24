export default function Loading() {
  return (
    <div
      className="content-container page-shell"
      role="status"
      aria-live="polite"
    >
      <p className="eyebrow mb-6">Memuat tampilan</p>
      <div className="grid gap-6 md:grid-cols-3" aria-hidden="true">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-60 animate-pulse rounded-3xl bg-secondary"
          />
        ))}
      </div>
      <p className="mt-5 text-sm text-muted-foreground">
        Menyiapkan halaman pratinjau…
      </p>
    </div>
  );
}
