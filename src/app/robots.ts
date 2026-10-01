import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/site";
import { routing } from "@/i18n/routing";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // On n'indexe pas l'espace staff ni les routes techniques. Les URL du
      // back-office portent la langue (`/fr/admin`, `/en/admin`) : on interdit
      // les deux, sinon la variante non listée resterait indexable.
      disallow: [
        ...routing.locales.flatMap((l) => [`/${l}/admin`, `/${l}/login`]),
        "/auth/",
        "/api/",
      ],
    },
    // Pas de directive `Host` : propre à Yandex, ignorée par Google, et elle
    // attend un nom de domaine, pas une URL. Le domaine canonique est déjà
    // porté par chaque page (`<link rel="canonical">`).
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
