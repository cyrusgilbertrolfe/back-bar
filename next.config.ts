import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The case label PDFs read the brand fonts off disk (lib/labels/fonts.ts).
  // public/ is served statically and is not otherwise in a function's bundle.
  outputFileTracingIncludes: {
    "/api/case-labels/**": ["./public/fonts/*.woff2"],
  },
};

export default nextConfig;
