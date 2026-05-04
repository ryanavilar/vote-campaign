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
      { source: "/faq", destination: "/form/faq", permanent: false },
      { source: "/panduan", destination: "/form/faq", permanent: false },
    ];
  },
};

export default nextConfig;
