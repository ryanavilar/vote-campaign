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
  async redirects() {
    return [
      { source: "/dpt", destination: "/form/gform", permanent: false },
      { source: "/gform", destination: "/form/gform", permanent: false },
    ];
  },
};

export default nextConfig;
