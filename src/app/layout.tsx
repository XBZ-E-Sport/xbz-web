import type { Metadata } from "next";
import { Orbitron } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

// Orbitron auto-hébergée par Next (RGPD-friendly), exposée en variable CSS
const orbitron = Orbitron({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  variable: "--font-orbitron",
});

export const metadata: Metadata = {
  title: "XBZ Esport",
  description:
    "XBZ Esport — structure compétitive Rocket League. Rejoins une équipe motivée et ambitieuse.",
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