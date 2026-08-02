"use client";

import { useEffect } from "react";

import { reportClientError } from "@/lib/client-report";

// Error boundary racine : remplace le layout quand une erreur non gérée casse
// le rendu. Doit fournir ses propres <html>/<body>. On remonte l'erreur au sink
// et on affiche un repli sobre avec un bouton de réessai.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportClientError({ message: error.message, stack: error.stack, digest: error.digest });
  }, [error]);

  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 20,
          padding: "24px",
          textAlign: "center",
          background: "linear-gradient(135deg, #070710 0%, #0b1b2e 55%, #06121f 100%)",
          color: "white",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>Une erreur est survenue</h1>
        <p style={{ maxWidth: 460, lineHeight: 1.5, color: "#9fb3c6", margin: 0 }}>
          Désolé, quelque chose s’est mal passé. L’équipe a été notifiée automatiquement. Tu peux
          réessayer ou revenir à l’accueil.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              cursor: "pointer",
              border: "none",
              borderRadius: 12,
              padding: "12px 28px",
              fontWeight: 700,
              color: "white",
              background: "linear-gradient(90deg, #00bfff, #0066ff)",
            }}
          >
            Réessayer
          </button>
          {/* Rechargement complet volontaire : le rendu racine a planté, on
              repart sur une page fraîche plutôt qu'une navigation client. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/"
            style={{
              borderRadius: 12,
              padding: "12px 28px",
              fontWeight: 700,
              color: "white",
              textDecoration: "none",
              border: "1px solid rgba(255,255,255,0.25)",
            }}
          >
            Accueil
          </a>
        </div>
      </body>
    </html>
  );
}
