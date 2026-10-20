import type { NextConfig } from "next";

const apiProxyTarget = process.env.API_PROXY_TARGET?.trim().replace(/\/+$/, "");

const nextConfig: NextConfig = {
  distDir: process.env.NEXUS_TEST_DIST_DIR ?? ".next",
  async rewrites() {
    return apiProxyTarget ? [{
      source: "/api/:path*",
      destination: `${apiProxyTarget}/api/:path*`,
    }] : [];
  },
};

export default nextConfig;
