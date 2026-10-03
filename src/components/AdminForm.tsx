"use client";

import { Fragment, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { oversizedUpload } from "@/lib/limits";
import { ADMIN_GENERIC_ERROR, adminFailure, type AdminAction } from "@/lib/admin-result";

/** Échec ATTENDU renvoyé par l'action : son message est montré tel quel. */
class ActionFailure extends Error {}

/**
 * Formulaire du back-office : une action serveur, plus ce qui manquait.
 *
 *  1. **Retour visuel** — un toast « Enregistrement… » qui devient succès ou
 *     erreur, avec le VRAI message (« Taille « M » en double. »…) : l'action
 *     le renvoie au lieu de le lever (voir src/lib/admin-result.ts).
 *  2. **Saisie conservée en cas d'erreur** — l'envoi est piloté ici plutôt que
 *     par `<form action>` : React réinitialise un formulaire d'action dès
 *     l'envoi, et une erreur effaçait tout ce qui venait d'être tapé. Rien
 *     n'est touché tant que l'action n'a pas réussi.
 *  3. **Après un succès**, selon le formulaire :
 *     - un formulaire d'AJOUT (sans champ `id`) repart à neuf : ses enfants
 *       sont remontés, ce qui vide aussi l'état des éditeurs (tailles…) que
 *       `form.reset()` ne voit pas ;
 *     - un formulaire de MODIFICATION (champ `id`) garde ce qui vient d'être
 *       enregistré. Le remettre « à zéro » le ramenait aux valeurs d'AVANT
 *       l'enregistrement : React ne met pas à jour le choix par défaut d'un
 *       menu déroulant après le premier rendu, si bien que le menu reprenait
 *       l'ancienne valeur, et l'enregistrement suivant la réécrivait en base.
 *       Seuls les fichiers choisis sont vidés (ils sont partis).
 *  4. **Repli de la carte** — le `<details>` parent se referme après un succès.
 *
 * Composant client, mais ses enfants restent rendus côté serveur : les
 * formulaires existants n'ont pas eu à changer de nature.
 */
export default function AdminForm({
  action,
  children,
  className,
  loadingMessage = "Enregistrement…",
  successMessage = "Enregistré",
  closeOnSuccess = true,
}: {
  action: AdminAction;
  children: React.ReactNode;
  className?: string;
  loadingMessage?: string;
  successMessage?: string;
  /** false pour une suppression : la carte disparaît d'elle-même. */
  closeOnSuccess?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  // Incrémenté après l'envoi réussi d'un formulaire d'ajout : remonte les enfants.
  const [fresh, setFresh] = useState(0);
  // Double clic : un seul envoi (l'état `pending` arrive un rendu trop tard).
  const busy = useRef(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const form = event.currentTarget;

    // Image trop lourde : annoncée AVANT l'envoi (le serveur rejetterait la
    // requête entière sans pouvoir expliquer pourquoi).
    const files = [...form.querySelectorAll<HTMLInputElement>('input[type="file"]')].flatMap((input) => [
      ...(input.files ?? []),
    ]);
    const tooBig = oversizedUpload(files);
    if (tooBig) {
      toast.error(tooBig);
      return;
    }

    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const formData = new FormData(form, submitter ?? undefined);
    busy.current = true;
    startTransition(async () => {
      const run = Promise.resolve()
        .then(() => action(formData))
        .then((result) => {
          const failure = adminFailure(result);
          if (failure) throw new ActionFailure(failure);
        });
      toast.promise(run, {
        loading: loadingMessage,
        success: successMessage,
        // Erreur imprévue (réseau, panne) : message générique, le détail est
        // dans les journaux du serveur.
        error: (e: unknown) => (e instanceof ActionFailure ? e.message : ADMIN_GENERIC_ERROR),
      });

      try {
        await run;
      } catch {
        // Déjà signalé par le toast ; saisie et carte conservées pour corriger.
        return;
      } finally {
        busy.current = false;
      }
      // Succès. Un formulaire de modification (champ `id`) garde ses valeurs :
      // ce sont celles qui viennent d'être enregistrées. Un formulaire d'ajout
      // repart à neuf.
      if (form.elements.namedItem("id")) {
        for (const input of form.querySelectorAll<HTMLInputElement>('input[type="file"]')) input.value = "";
      } else {
        setFresh((n) => n + 1);
      }
      if (closeOnSuccess) form.closest("details")?.removeAttribute("open");
    });
  }

  return (
    // `method="post"` : un envoi avant que la page ne soit interactive ne met
    // pas la saisie dans l'adresse (GET par défaut).
    <form method="post" onSubmit={handleSubmit} aria-busy={pending || undefined} className={className}>
      <Fragment key={fresh}>{children}</Fragment>
    </form>
  );
}
