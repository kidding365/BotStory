import type { NextConfig } from "next";

const repoName = "BotStory";
const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  output: "export",
  // When deployed to https://kidding365.github.io/BotStory/, the static export
  // must include the /BotStory prefix in all asset URLs. In dev we run at /.
  basePath: isProd ? `/${repoName}` : "",
  assetPrefix: isProd ? `/${repoName}/` : "",
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
};

export default nextConfig;
