import { createFileRoute } from '@tanstack/react-router';

import { ChirpLandingPage } from '~/chirp/components/ChirpLandingPage';

export const Route = createFileRoute('/chirp/')({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="flex flex-col items-center bg-chirp-page">
      <div className="relative z-10 flex w-full max-w-7xl justify-center">
        <div
          className="
            pointer-events-none absolute -top-[60px] -left-[100px] h-[400px]
            w-[500px] rounded-full
            bg-[radial-gradient(ellipse,color-mix(in_srgb,var(--chirp-accent)_8%,transparent)_0%,transparent_70%)]
          "
        />
        <div
          className="
            pointer-events-none absolute -top-[40px] right-[80px] hidden
            h-[350px] w-[450px] rounded-full
            bg-[radial-gradient(ellipse,color-mix(in_srgb,var(--chirp-accent)_6%,transparent)_0%,transparent_70%)]
            lg:block
          "
        />
      </div>
      <ChirpLandingPage />
    </div>
  );
}
