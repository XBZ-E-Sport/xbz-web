import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/site";

// Web App Manifest → généré sur /manifest.webmanifest et lié automatiquement
// par Next. Permet « Ajouter à l'écran d'accueil » (PWA) sur mobile.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${siteConfig.name} — Rocket League`,
    short_name: siteConfig.shortName,
    description: siteConfig.description,
    lang: "fr",
    // Préfixé : toutes les URL portent leur langue depuis le passage en
    // bilingue. `/` ne fait plus que rediriger (308) — la PWA payait ce rebond
    // à chaque lancement.
    start_url: "/fr",
    scope: "/",
    display: "standalone",
    background_color: "#070710", // fond de l'écran de démarrage (sombre, comme le site)
    theme_color: "#070710", // teinte de la barre d'état / d'adresse
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
