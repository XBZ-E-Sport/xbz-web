// État de chargement affiché pendant le rendu serveur des pages (la plupart sont
// en force-dynamic). Un simple spinner brandé, centré sous le header fixe.
export default function Loading() {
  return (
    <div className="relative z-10 flex min-h-[70svh] items-center justify-center px-6 pt-32">
      <div className="flex flex-col items-center gap-4 text-neutral-400">
        <span
          aria-hidden="true"
          className="h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-xbz-cyan"
        />
        <p className="text-sm" role="status">
          Chargement…
        </p>
      </div>
    </div>
  );
}
