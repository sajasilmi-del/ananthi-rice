import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    DELIVERY_ORIGIN_LATITUDE: process.env.DELIVERY_ORIGIN_LATITUDE ?? "",
    DELIVERY_ORIGIN_LONGITUDE: process.env.DELIVERY_ORIGIN_LONGITUDE ?? "",
    AUTH_PROVIDER: process.env.AUTH_PROVIDER ?? "",
  },
  images: {
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
