import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['better-sqlite3'],
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
