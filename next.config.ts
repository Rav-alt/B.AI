import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The API reads these with fs at runtime; make sure they're bundled with the serverless function.
  outputFileTracingIncludes: {
    "/api/chat": ["./data/generated/network.json", "./data/landmarks.json"],
  },
};

export default nextConfig;
