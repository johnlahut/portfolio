import {
  Outlet,
  createFileRoute,
  redirect,
  retainSearchParams,
  stripSearchParams,
} from '@tanstack/react-router';
import { useState } from 'react';
import { z } from 'zod';

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

import { ImageMasonry } from '~/chirp/components/ImageMasonry';
import { PersonRow } from '~/chirp/components/PersonRow';
import { checkAuthOptions, useImages } from '~/chirp/hooks';

const defaultParams = {
  page: 1,
  sortBy: undefined as string | undefined,
};

const searchSchema = z.object({
  page: z.number().int().positive().catch(defaultParams.page).default(1),
  sortBy: z.string().optional(),
});

export const Route = createFileRoute('/chirp')({
  component: RouteComponent,
  validateSearch: searchSchema,
  search: {
    middlewares: [stripSearchParams(defaultParams), retainSearchParams(true)],
  },
  beforeLoad: async ({ context: { queryClient } }) => {
    const authenticated = await queryClient.ensureQueryData(checkAuthOptions);
    if (!authenticated) {
      throw redirect({ to: '/chirp/login' });
    }
  },
});

function RouteComponent() {
  const { imagesLoading, imagesError } = useImages();
  const [showOverlays, setShowOverlays] = useState(true);

  if (imagesLoading) return <div className="p-4">Loading...</div>;
  if (imagesError) return <div className="p-4">Error loading images</div>;

  return (
    <div className="pl-4 h-full flex flex-col overflow-auto">
      <h1 className="text-2xl font-bold">Images</h1>
      <div className="flex flex-row justify-between">
        <PersonRow />
        <div className="flex items-center gap-2">
          <Switch
            id="face-overlays"
            checked={showOverlays}
            onCheckedChange={setShowOverlays}
            size="sm"
          />
          <Label htmlFor="face-overlays" className="text-sm">
            Face overlays
          </Label>
        </div>
      </div>
      <ImageMasonry showFaceOverlays={showOverlays} />
      <Outlet />
    </div>
  );
}
