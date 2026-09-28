"use client";

import { useRef, useTransition } from "react";
import { toast } from "sonner";

import { oversizedUpload } from "@/lib/limits";

/**
 * Formulaire du back-office : même `<form action={serverAction}>` qu'avant, plus
 * deux comportements qui manquaient.
 *
 *  1. **Retour visuel** — un toast « Enregistrement… » qui devient succès ou
 *     erreur. Sans ça, un clic sur Enregistrer ne produisait aucun signal.
 *  2. **Repli de la carte** — le `<details>` parent se referme après un succès.
 *     Il n'existait aucun moyen de refermer une carte ouverte.
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
  action: (formData: FormData) => void | Promise<void>;
  children: React.ReactNode;
  className?: string;
  loadingMessage?: string;
  successMessage?: string;
  /** false pour une suppression : la carte disparaît d'elle-même. */
  closeOnSuccess?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [, startTransition] = useTransition();

  // Image trop lourde : annoncée AVANT l'envoi (le serveur rejetterait la
  // requête entière sans pouvoir expliquer pourquoi). Dans `onSubmit`, pas dans
  // l'action : `preventDefault` y bloque l'envoi SANS que React réinitialise le
  // formulaire, donc rien de ce qui a été saisi n'est perdu.
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const files = [...event.currentTarget.querySelectorAll<HTMLInputElement>('input[type="file"]')].flatMap(
      (input) => [...(input.files ?? [])],
    );
    const tooBig = oversizedUpload(files);
    if (tooBig) {
      event.preventDefault();
      toast.error(tooBig);
    }
  }

  function handleAction(formData: FormData) {
    startTransition(async () => {
      const run = Promise.resolve(action(formData));

      toast.promise(run, {
        loading: loadingMessage,
        success: successMessage,
        // Next masque le message des erreurs serveur en production : on reste
        // volontairement générique plutôt que d'afficher « An error occurred ».
        error: "Échec de l’enregistrement. Réessaie ou recharge la page.",
      });

      try {
        await run;
        if (closeOnSuccess) {
          // Referme la carte dépliée qui contient ce formulaire (s'il y en a une).
          formRef.current?.closest("details")?.removeAttribute("open");
        }
      } catch {
        // Déjà signalé par le toast ; on garde la carte ouverte pour corriger.
      }
    });
  }

  return (
    <form ref={formRef} action={handleAction} onSubmit={handleSubmit} className={className}>
      {children}
    </form>
  );
}
