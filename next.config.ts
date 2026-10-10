import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXUS_TEST_DIST_DIR ?? ".next",
};

export default nextConfig;
