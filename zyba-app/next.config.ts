import type { NextConfig } from "next";

const apiProxyTarget = (process.env.API_PROXY_TARGET || "http://127.0.0.1:3002/server/Zoho_api").replace(/\/$/, "");

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "192.168.99.111",
    "http://192.168.99.111:3000",
    "192.168.99.111:3000",
    "192.168.99.171",
    "http://192.168.99.171:3001",
    "192.168.99.171:3001",
  ],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiProxyTarget}/:path*`,
      },
    ];
  },
};

export default nextConfig;
