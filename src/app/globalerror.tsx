"use client";

// Frontière d'erreur ultime : ne se déclenche que si le layout racine lui-même
// plante. Elle remplace tout le document (html/body) → styles en ligne, car la
// CSS de l'app n'est pas garantie ici.
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
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
          gap: "1rem",
          background: "#0a0a0e",
          color: "#e5e5e5",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: "1.5rem",
        }}
      >
        <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#fff" }}>
          Une erreur est survenue
        </h1>
        <p style={{ maxWidth: "32rem", lineHeight: 1.6, color: "#a3a3a3" }}>
          Le site a rencontré un problème inattendu. Réessaie dans un instant.
        </p>
        <button
          onClick={reset}
          style={{
            border: "none",
            borderRadius: "0.75rem",
            background: "#0066ff",
            color: "#fff",
            fontWeight: 700,
            padding: "0.75rem 1.75rem",
            cursor: "pointer",
          }}
        >
          Réessayer
        </button>
      </body>
    </html>
  );
}
