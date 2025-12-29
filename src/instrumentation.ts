import * as Sentry from "@sentry/nextjs";

export function register() {
  Sentry.init({
    dsn: "https://3151b20c33b1c131ed30b11f537f09bd@o4507236699996160.ingest.de.sentry.io/4507236704452688",

    // Adjust this value in production, or use tracesSampler for greater control
    tracesSampleRate: 1,

    // Setting this option to true will print useful information to the console while you're setting up Sentry.
    debug: false,
  });
}
