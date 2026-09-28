import type { NextConfig } from "next";

const config: NextConfig = {
  // @hyphae/core ships TypeScript source.
  transpilePackages: ["@hyphae/core"],
  poweredByHeader: false,
  // The bot links each score to /x/<contribution id> (PUBLIC_WEB_URL in apps/api).
  async redirects() {
    return [{ source: "/x/:id", destination: "/contribution/:id", permanent: true }];
  },
};

export default config;
