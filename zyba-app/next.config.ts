import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "192.168.99.111",
    "http://192.168.99.111:3000",
    "192.168.99.111:3000",
    "192.168.99.171",
    "http://192.168.99.171:3001",
    "192.168.99.171:3001",
  ],
};

export default nextConfig;
