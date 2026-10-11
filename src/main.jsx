import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { router } from './router';
import './index.css';
// Error monitoring is loaded only when configured, to keep the bundle small.
if (import.meta.env.VITE_SENTRY_DSN) import('./lib/sentry');

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 20 * 1000,
      retry: (count, err) => count < 1 && ![401, 403, 404].includes(err?.response?.status),
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster richColors position="top-center" closeButton />
    </QueryClientProvider>
  </StrictMode>,
);
