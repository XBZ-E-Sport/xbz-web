import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/a-propos", destination: "/presentation", permanent: true },
    ];
  },
};

export default nextConfig;
