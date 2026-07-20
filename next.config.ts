import type { NextConfig } from "next";

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
};

export default nextConfig;
