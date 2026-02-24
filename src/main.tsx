import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import axios from 'axios';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Parser } from 'web-tree-sitter';

import { api, clearToken } from '@/lib/api';

import { ThemeProvider } from '~/theme-provider.tsx';

import './index.css';
import { routeTree } from './routeTree.gen.ts';

Parser.init({ locateFile: () => '/tree-sitter.wasm' }).then(() => {
  /* the library is ready */
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
    },
  },
});

const router = createRouter({
  routeTree,
  context: { queryClient },
});

let redirectingToLogin = false;

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      clearToken();
      queryClient.setQueryData(['auth'], false);
      const isOnLoginRoute = router.state.location.pathname === '/chirp/login';

      if (!isOnLoginRoute && !redirectingToLogin) {
        redirectingToLogin = true;
        router.navigate({ to: '/chirp/login', replace: true }).finally(() => {
          redirectingToLogin = false;
        });
      }
    }
    return Promise.reject(error);
  },
);

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById('root')!;
if (!rootElement.innerHTML) {
  createRoot(rootElement).render(
    <StrictMode>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </ThemeProvider>
    </StrictMode>,
  );
}
