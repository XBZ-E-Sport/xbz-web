import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Domaines autorisés pour les photos de joueurs (next/image).
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" }, // Supabase Storage (<ref>.supabase.co)
      { protocol: "https", hostname: "cdn.discordapp.com" }, // avatars Discord
    ],
  },
  async redirects() {
    return [
      { source: "/a-propos", destination: "/presentation", permanent: true },
    ];
  },
};

export default nextConfig;
