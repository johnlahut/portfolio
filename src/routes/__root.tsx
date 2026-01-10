import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import {
  Link,
  Outlet,
  createRootRoute,
  linkOptions,
} from '@tanstack/react-router';
import { Breadcrumb, BreadcrumbItem, BreadcrumbList } from '@/components/ui/breadcrumb';
import { common, createStarryNight } from '@wooorm/starry-night';
import tsxGrammar from '@wooorm/starry-night/source.tsx';

export const Route = createRootRoute({
  component: RootComponent,
  loader: async () =>  await createStarryNight([...common, tsxGrammar]),
});
const options = linkOptions([
  {
    to: '/transformer',
    label: 'Navo',
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
        <div className="space-x-1">
        </div>
      </Breadcrumb>
      <Outlet />
      {/* <Toaster /> */}
    <TanStackRouterDevtools position="bottom-right" />
    </>
  );
}
