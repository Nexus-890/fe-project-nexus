import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXUS_TEST_DIST_DIR ?? ".next",
  typescript: { tsconfigPath: process.env.NEXUS_TSCONFIG ?? "tsconfig.json" },
};

export default nextConfig;
