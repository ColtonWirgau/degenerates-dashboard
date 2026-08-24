import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev-tools floating indicator sits bottom-left, exactly under the
  // shell's mobile dock — it blocks taps in dev (and Playwright clicks).
  devIndicators: false,
};

export default nextConfig;
