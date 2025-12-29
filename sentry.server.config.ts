// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

Sentry.init({
  dsn: "https://3151b20c33b1c131ed30b11f537f09bd@o4507236699996160.ingest.de.sentry.io/4507236704452688",

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 1,
  profilesSampleRate: 1.0, // Profiling sample rate is relative to tracesSampleRate

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: process.env.NODE_ENV === 'development',

  integrations: [
    // Add profiling integration to list of integrations
    nodeProfilingIntegration(),
  ],
});
