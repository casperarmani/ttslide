import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '6j4z75qrkspis7fw.public.blob.vercel-storage.com',
        port: '', // Keep empty string for default port (443 for https)
        pathname: '/**', // Allow any path under this hostname
      },
      // You can add other hostnames here if needed in the future
    ],
  },
  /* other existing config options here */

};

export default nextConfig;
