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
    sitemap: `${siteConfig.url}/sitemap.xml`,
    host: siteConfig.url,
  };
}
