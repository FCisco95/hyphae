import type { NextConfig } from "next";

const config: NextConfig = {
  // @hyphae/core ships TypeScript source.
  transpilePackages: ["@hyphae/core"],
  poweredByHeader: false,
};

export default config;
