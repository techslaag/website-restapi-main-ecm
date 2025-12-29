/** @type {import('next').NextConfig} */
const nextConfig = {
  staticPageGenerationTimeout: 15 * 60,
  cacheMaxMemorySize: 0,
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  experimental: {
    serverComponentsExternalPackages: ["pdfkit", "mailgen"],
  },
  webpack: (config) => {
    // config.resolve.alias.canvas = false;

    config.module.rules.push(
      ...[
        // bundle and load afm files verbatim
        { test: /\.afm$/, type: "asset/source" },
        {
          enforce: "post",
          test: /fontkit[/\\]index.js$/,
          loader: "transform-loader",
          options: {
            brfs: {},
          },
        },
        {
          enforce: "post",
          test: /linebreak[/\\]src[/\\]linebreaker.js/,
          loader: "transform-loader",
          options: {
            brfs: {},
          },
        },
      ],
    );

    return config;
  },
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET,DELETE,PATCH,POST,PUT",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "*",
          },
        ],
      },
      {
        source: "/:path*",
        headers: [
          {
            key: "Document-Policy",
            value: "js-profiling",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;

// Injected content via Sentry wizard below

const { withSentryConfig } = require("@sentry/nextjs");

module.exports = withSentryConfig(
  module.exports,
  {
    // For all available options, see:
    // https://github.com/getsentry/sentry-webpack-plugin#options

    // Suppresses source map uploading logs during build
    silent: true,
    org: "ecomatin",
    project: "ecomatin-api-nextjs",
  },
  {
    // For all available options, see:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

    // Upload a larger set of source maps for prettier stack traces (increases build time)
    widenClientFileUpload: true,

    // Transpiles SDK to be compatible with IE11 (increases bundle size)
    transpileClientSDK: true,

    // Uncomment to route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
    // This can increase your server load as well as your hosting bill.
    // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
    // side errors will fail.
    // tunnelRoute: "/monitoring",

    // Hides source maps from generated client bundles
    hideSourceMaps: true,

    // Automatically tree-shake Sentry logger statements to reduce bundle size
    disableLogger: true,

    // Enables automatic instrumentation of Vercel Cron Monitors.
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,
  },
);