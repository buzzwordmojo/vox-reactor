import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@vox-reactor/core", "@vox-reactor/react"],
};

export default nextConfig;
