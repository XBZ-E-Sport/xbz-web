import type { Metadata } from "next";
import { Orbitron } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { siteConfig } from "@/lib/site";

// Orbitron auto-hébergée par Next (RGPD-friendly), exposée en variable CSS
const orbitron = Orbitron({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  variable: "--font-orbitron",
});

const defaultTitle = `${siteConfig.name} — Structure compétitive Rocket League`;

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: defaultTitle,
    // Les pages définissent leur propre titre complet ; "%s" le laisse tel quel.
    template: "%s",
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  keywords: ["XBZ", "XBZ Esport", "esport", "Rocket League", "équipe compétitive", "recrutement gaming"],
  authors: [{ name: siteConfig.name }],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: siteConfig.locale,
    url: siteConfig.url,
    siteName: siteConfig.name,
    title: defaultTitle,
    description: siteConfig.description,
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: siteConfig.description,
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={orbitron.variable}>
      <body className="font-sans antialiased">
        <a href="#main" className="skip-link">
          Aller au contenu principal
        </a>
        <Header />
        <main id="main" tabIndex={-1}>
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}