import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { Bruno_Ace_SC, Special_Gothic_Expanded_One, Sarabun, Oswald } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { siteConfig, localizedPath } from "@/lib/site";
import { routing } from "@/i18n/routing";

// Polices de la charte, auto-hébergées par Next (RGPD-friendly), exposées en
// variables CSS. Les noms de variables NE doivent PAS entrer en collision avec
// les clés @theme (--font-display/-subtitle/-impact/-sans), qui les référencent.
//
// Titres — Bruno Ace SC (charte). Poids unique 400.
const fontTitle = Bruno_Ace_SC({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-title",
  display: "swap",
});
// Sous-titres — Special Gothic Expanded One (charte). Poids unique 400.
// `adjustFontFallback: false` : next/font n'a pas les métriques de cette police
// récente pour générer un fallback anti-CLS et log un warning à chaque requête.
// On désactive donc ce fallback auto (inopérant de toute façon) → plus de warning.
const fontSubtitle = Special_Gothic_Expanded_One({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-subtitle-family",
  display: "swap",
  adjustFontFallback: false,
  fallback: ["system-ui", "sans-serif"],
});
// Corps — Sarabun (charte).
const fontBody = Sarabun({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});
// Mots-chocs — Oswald condensé : vrais gros poids là où Bruno Ace SC / Special
// Gothic n'ont que le 400 (hero « FROM ZERO TO LEGEND », gros scores, 404).
const fontImpact = Oswald({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-impact-family",
  display: "swap",
});

/** Prégénère les deux langues au build (rendu statique conservé). */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Omit<LayoutProps, "children">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "site" });
  const defaultTitle = `${siteConfig.name} — ${t("tagline")}`;

  return {
    metadataBase: new URL(siteConfig.url),
    title: {
      default: defaultTitle,
      // Les pages définissent leur propre titre complet ; "%s" le laisse tel quel.
      template: "%s",
    },
    description: t("description"),
    applicationName: siteConfig.name,
    keywords: t("keywords").split(","),
    authors: [{ name: siteConfig.name }],
    alternates: {
      canonical: localizedPath("/", locale),
      // hreflang : indique à Google que ces deux pages sont la même, en deux langues.
      languages: { fr: localizedPath("/", "fr"), en: localizedPath("/", "en") },
    },
    openGraph: {
      type: "website",
      locale: locale === "fr" ? "fr_FR" : "en_US",
      url: localizedPath("/", locale),
      siteName: siteConfig.name,
      title: defaultTitle,
      description: t("description"),
    },
    twitter: {
      card: "summary_large_image",
      title: defaultTitle,
      description: t("description"),
    },
  };
}

// Couleur de thème mobile (barre d'adresse/statut) — sombre, comme le site.
// En Next 16, `themeColor` vit dans l'export `viewport` (plus dans `metadata`).
export const viewport: Viewport = {
  themeColor: "#0a0a0a",
};

export default async function LocaleLayout({ children, params }: LayoutProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  // Indispensable pour garder le rendu statique : sans cet appel, toute page
  // qui lit une traduction bascule en rendu dynamique.
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "layout" });
  // `locale` et `messages` sont passés EXPLICITEMENT au provider.
  //
  // Sans eux, next-intl les déduit du contexte de requête — qui n'existe pas
  // pendant le prérendu d'une page `force-static` : la coquille (en-tête, pied
  // de page, liens) repartait alors en français sur les pages anglaises, avec
  // des liens vers `/fr/…`, sans la moindre erreur pour le signaler.
  const messages = await getMessages({ locale });

  return (
    <html
      lang={locale}
      className={`${fontTitle.variable} ${fontSubtitle.variable} ${fontBody.variable} ${fontImpact.variable}`}
    >
      <body className="font-sans antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <a href="#main" className="skip-link">
            {t("skipToContent")}
          </a>
          <Header />
          <main id="main" tabIndex={-1}>
            {children}
          </main>
          <Footer locale={locale} />
          {/* Mesure d'audience Vercel : sans cookie, endpoints same-origin
              (/_vercel/insights) → compatible avec la CSP stricte, aucun ajout. */}
          <Analytics />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
