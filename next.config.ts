import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  experimental: { agentUpgrade: false },
  distDir: process.env.NEXUS_TEST_DIST_DIR ?? ".next",
  typescript: { tsconfigPath: process.env.NEXUS_TSCONFIG ?? "tsconfig.json" },
  async rewrites() {
    const target = process.env.API_PROXY_TARGET?.trim();
    if (!target) return [];
    const url = new URL(target);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      throw new Error(
        "API_PROXY_TARGET must be an HTTP(S) origin without a path or credentials.",
      );
    return [
      { source: "/api/v1/:path*", destination: `${url.origin}/api/v1/:path*` },
    ];
  },
};

export default nextConfig;
