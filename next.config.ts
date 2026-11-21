import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Dev-only Next.js indicator; production builds never show it.
  // Disabled so local review screenshots are not obstructed.
  devIndicators: false,
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
