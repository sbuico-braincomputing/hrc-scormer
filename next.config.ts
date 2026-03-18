import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  env: {
    SOCIAL_URL: process.env.SOCIAL_URL,
  },
  images: {
   remotePatterns: [
    {
      protocol: "https",
      hostname: "i.vimeocdn.com",
    },
    {
      protocol: "https",
      hostname: "www.myhrgoal.com",
    },
   ],
  }
};

export default nextConfig;
