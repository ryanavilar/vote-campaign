import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ikastarakita.com",
      },
      {
        protocol: "https",
        hostname: "lh7-rt.googleusercontent.com",
      },
    ],
  },
};

export default nextConfig;
