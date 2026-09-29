import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloudflare quick tunnels (`*.trycloudflare.com`) for local webhook forwarding
  allowedDevOrigins: ["*.trycloudflare.com"],
};

export default nextConfig;
