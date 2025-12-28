import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  // Optional: Change this if your repo is not at the root (username.github.io)
  // basePath: '/your-repo-name',
};

export default nextConfig;
