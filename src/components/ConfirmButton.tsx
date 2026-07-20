"use client";

// Bouton submit qui demande confirmation avant d'envoyer le formulaire.
export default function ConfirmButton({
  children,
  className,
  message = "Confirmer ? Cette action est irréversible.",
}: {
  children: React.ReactNode;
  className?: string;
  message?: string;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
