"use client";

import { useRef, useTransition } from "react";
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
 *     l'envoi, et une erreur effaçait tout ce qui venait d'être tapé. Le
 *     formulaire n'est remis à zéro qu'après un succès.
 *  3. **Repli de la carte** — le `<details>` parent se referme après un succès.
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
      // Succès : le formulaire repart des valeurs enregistrées (un formulaire
      // d'ajout se vide), puis la carte dépliée qui le contient se referme.
      form.reset();
      if (closeOnSuccess) form.closest("details")?.removeAttribute("open");
    });
  }

  return (
    // `method="post"` : un envoi avant que la page ne soit interactive ne met
    // pas la saisie dans l'adresse (GET par défaut).
    <form method="post" onSubmit={handleSubmit} aria-busy={pending || undefined} className={className}>
      {children}
    </form>
  );
}
