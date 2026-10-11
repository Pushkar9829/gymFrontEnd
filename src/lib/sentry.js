import * as Sentry from '@sentry/react';

// Imported from main.jsx only when VITE_SENTRY_DSN is set at build time.
Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN, environment: import.meta.env.MODE, tracesSampleRate: 0 });
