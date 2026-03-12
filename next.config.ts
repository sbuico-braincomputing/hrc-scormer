import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  env: {
    SOCIAL_URL: process.env.SOCIAL_URL,
  },
};

export default nextConfig;
