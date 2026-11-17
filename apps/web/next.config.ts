import type { NextConfig } from "next";

const config: NextConfig = {
  // @hyphae/core ships TypeScript source; the web reads @hyphae/admin-client's source too
  // (its dist is a build artifact, not committed).
  transpilePackages: ["@hyphae/core", "@hyphae/admin-client"],
  poweredByHeader: false,
  // The bot links each score to /x/<contribution id> (PUBLIC_WEB_URL in apps/api).
  async redirects() {
    return [{ source: "/x/:id", destination: "/contribution/:id", permanent: true }];
  },
};

export default config;
