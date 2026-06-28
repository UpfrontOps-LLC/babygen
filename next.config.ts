import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,
  trailingSlash: false,
  images: {
    // applies when components migrate to next/image; harmless otherwise
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
