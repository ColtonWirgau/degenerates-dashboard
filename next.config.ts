import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Avatars once a Blob store is attached (lib/storage).
      { protocol: 'https', hostname: '*.public.blob.vercel-storage.com' },
      // NFL team crests (nfl_teams.logo_url).
      { protocol: 'https', hostname: 'a.espncdn.com' },
    ],
  },
  // The dev-tools floating indicator sits bottom-left, exactly under the
  // shell's mobile dock — it blocks taps in dev (and Playwright clicks).
  devIndicators: false,
};

export default nextConfig;
