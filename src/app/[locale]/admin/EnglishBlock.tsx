import type { ReactNode } from "react";

/**
 * Repli dépliable regroupant les champs anglais d'un formulaire du back-office.
 *
 * Les traductions sont FACULTATIVES : un champ vide fait retomber la page `/en`
 * sur le français. Les regrouper ici évite de doubler la hauteur de chaque
 * formulaire pour du contenu qu'on remplit rarement dans la foulée.
 *
 * Le bloc s'ouvre tout seul quand une traduction existe déjà (`filled`) — sinon
 * on éditerait un article sans voir qu'il a une version anglaise à mettre à jour.
 */
export default function EnglishBlock({
  children,
  filled = false,
}: {
  children: ReactNode;
  /** Une des traductions est-elle déjà saisie ? */
  filled?: boolean;
}) {
  return (
    <details
      open={filled}
      className="group rounded-lg border border-white/10 bg-white/2 p-3 sm:col-span-2"
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-400 hover:text-neutral-200">
        <span
          aria-hidden="true"
          className="text-xbz-cyan transition-transform duration-200 group-open:rotate-45"
        >
          +
        </span>
        Version anglaise
        <span className="font-normal normal-case tracking-normal text-neutral-500">
          {filled ? "— déjà traduite" : "— facultative, sinon le site affiche le français"}
        </span>
      </summary>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
    </details>
  );
}
