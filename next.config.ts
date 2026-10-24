import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
