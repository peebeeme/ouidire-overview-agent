import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/overview": ["./data/**/*"],
  },
};

export default nextConfig;
