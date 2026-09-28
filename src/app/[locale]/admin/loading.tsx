// Indicateur de chargement du back-office SEULEMENT : ses pages sont rendues à
// chaque requête (lectures en base), la navigation y mérite un retour visuel.
//
// Pas de `loading.tsx` sur le site public : un `loading.tsx` fait envoyer la
// page en flux, le statut HTTP part donc en 200 avant que la page sache si elle
// existe — et un `notFound()` ne peut plus le changer (doc Next,
// file-conventions/loading.md, « Status Codes »). Les pages publiques sont
// prérendues : elles n'en ont pas besoin, et leurs 404 restent de vraies 404.
export default function AdminLoading() {
  return (
    <div className="flex min-h-[50svh] items-center justify-center">
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
