import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The generated PDFs read the brand fonts off disk (lib/labels/fonts.ts).
  // public/ is served statically and is not otherwise in a function's bundle.
  outputFileTracingIncludes: {
    "/api/case-labels/**": ["./public/fonts/*.woff2"],
    "/api/order-confirmation/**": ["./public/fonts/*.woff2"],
    "/sell/orders/**": ["./public/fonts/*.woff2"],
  },
};

export default nextConfig;
