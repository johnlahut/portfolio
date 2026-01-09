import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import {
  Outlet,
  createRootRoute,
} from '@tanstack/react-router';

export const Route = createRootRoute({
  component: RootComponent
});

function RootComponent() {
  return (
    <>
      <Outlet />
      {/* <Toaster /> */}
    <TanStackRouterDevtools position="bottom-right" />
    </>
  );
}
