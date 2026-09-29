import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  // Prevent Next.js from bundling pdf-parse — it must run as a native Node.js module
  serverExternalPackages: ["pdf-parse"],
  // Turbopack config (Next.js 16+ default bundler)
  turbopack: {
    resolveAlias: {
      // Silence the optional @napi-rs/canvas dependency warning from pdf-parse
      canvas: { browser: "./empty-module.js" },
    },
  },
};

export default nextConfig;