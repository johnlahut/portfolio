import type { QueryClient } from '@tanstack/react-query';
import {
  Link,
  Outlet,
  createRootRouteWithContext,
  linkOptions,
} from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import { common, createStarryNight } from '@wooorm/starry-night';
import tsxGrammar from '@wooorm/starry-night/source.tsx';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
} from '@/components/ui/breadcrumb';

type RouterContext = {
  queryClient: QueryClient;
};

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
  loader: async () => await createStarryNight([...common, tsxGrammar]),
});
const options = linkOptions([
  {
    to: '/transformer',
    label: 'Navo',
  },
  {
    to: '/chirp',
    label: 'Chirp',
  },
]);
function RootComponent() {
  return (
    <>
      <Breadcrumb>
        <BreadcrumbList>
          {options.map((link) => (
            <BreadcrumbItem key={link.to}>
              <Link {...link}>{link.label}</Link>
            </BreadcrumbItem>
          ))}
        </BreadcrumbList>
        <div className="space-x-1"></div>
      </Breadcrumb>
      <Outlet />
      {import.meta.env.DEV && (
        <TanStackRouterDevtools position="bottom-right" />
      )}
    </>
  );
}
