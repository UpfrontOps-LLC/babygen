import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,
  trailingSlash: false,
  // Opt-out of the in-build TS pass only when SKIP_BUILD_CHECKS=1 (memory-
  // constrained staging builds; types are verified separately via `tsc --noEmit`).
  typescript: { ignoreBuildErrors: process.env.SKIP_BUILD_CHECKS === "1" },
  // Single page-collection worker keeps peak memory low on a shared box.
  experimental: { cpus: 1 },
  images: {
    // applies when components migrate to next/image; harmless otherwise
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;

// OpenNext (Cloudflare) dev integration: makes the Cloudflare bindings (KV
// SESSIONS/META, the GENERATE_BABY Workflow) available to `getCloudflareContext()`
// while running `next dev` — which is what the Playwright e2e runs against.
// Without this, every binding access throws in dev and the suite breaks.
// It's a no-op in production builds.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
