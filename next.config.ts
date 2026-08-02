import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// --- Content Security Policy ---------------------------------------------
// Tout en `self` par défaut. Le site n'embarque AUCUN script tiers ; les seules
// sources externes sont Supabase (REST / Auth / Storage / Realtime) et les
// images du bucket public. `'unsafe-inline'` couvre les scripts d'hydratation
// injectés par Next + les blocs JSON-LD (le contenu utilisateur, lui, est déjà
// échappé par React). En dev, React a besoin de `'unsafe-eval'`.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co",
  "font-src 'self'",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  // Force HTTPS en prod ; omis en dev (localhost en http, casserait le HMR).
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  // Ignoré par les navigateurs en http/localhost → sans effet en dev.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  images: {
    // Photos des membres hébergées sur Supabase Storage (bucket public "joueurs").
    // `*.supabase.co` couvre le sous-domaine du projet (ex: abcd1234.supabase.co).
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  async redirects() {
    return [
      { source: "/a-propos", destination: "/presentation", permanent: true },
    ];
  },
  async headers() {
    // En-têtes de sécurité appliqués à toutes les routes.
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
