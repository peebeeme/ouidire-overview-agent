import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    outputFileTracingIncludes: {
      "/api/overview": ["./data/**/*"],
    },
  },
};

export default nextConfig;
