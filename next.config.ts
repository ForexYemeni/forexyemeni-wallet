import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Required for PWA: allow images from external domains
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
