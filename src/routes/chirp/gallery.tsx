import {
  Link,
  Outlet,
  createFileRoute,
  redirect,
  retainSearchParams,
  stripSearchParams,
  useNavigate,
  useSearch,
} from '@tanstack/react-router';
import { Search, Settings2, Upload } from 'lucide-react';
import { useEffect, useState } from 'react';
import { z } from 'zod';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { AddPersonDialog } from '~/chirp/components/AddPersonDialog';
import { ChirpLogo } from '~/chirp/components/ChirpLogo';
import { FaceOverlaySwitch } from '~/chirp/components/FaceOverlaySwitch';
import { FaceStateChip } from '~/chirp/components/FaceStateChip';
import { GallerySidebar } from '~/chirp/components/GallerySidebar';
import { ImageMasonry } from '~/chirp/components/ImageMasonry';
import { MobileFilterSheet } from '~/chirp/components/MobileFilterSheet';
import { PersonChip } from '~/chirp/components/PersonChip';
import { checkAuthOptions, usePeople } from '~/chirp/hooks';

const defaultParams = {
  sortBy: undefined as string | undefined,
  search: undefined as string | undefined,
};

const searchSchema = z.object({
  sortBy: z.string().optional(),
  search: z.string().optional(),
});

export const Route = createFileRoute('/chirp/gallery')({
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
  const { people } = usePeople();
  const navigate = useNavigate({ from: '/chirp/gallery' });
  const { sortBy, search } = useSearch({ from: '/chirp/gallery' });

  const [showOverlays, setShowOverlays] = useState(true);
  const [searchInput, setSearchInput] = useState(search ?? '');

  const peopleList = people?.people ?? [];

  // Sync local input when URL param changes (e.g. back/forward navigation)
  useEffect(() => {
    setSearchInput(search ?? '');
  }, [search]);

  // Debounce URL update on search input changes
  useEffect(() => {
    const id = setTimeout(() => {
      navigate({
        search: (prev) => ({ ...prev, search: searchInput || undefined }),
      });
    }, 300);
    return () => clearTimeout(id);
  }, [searchInput, navigate]);

  const handlePersonClick = (personId: string) => {
    navigate({
      search: (prev) => ({
        ...prev,
        sortBy: sortBy === personId ? undefined : personId,
      }),
    });
  };

  const handleClearFilter = () => {
    navigate({ search: (prev) => ({ ...prev, sortBy: undefined }) });
  };

  const selectedPeople = peopleList.filter((p) => sortBy === p.id);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-chirp-bg font-sans">
      {/* ── Desktop Sidebar ─────────────────────────────────── */}
      <GallerySidebar
        people={peopleList}
        sortBy={sortBy}
        onPersonClick={handlePersonClick}
        onClearFilter={handleClearFilter}
      />

      {/* ── Main Content ────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* ── Desktop Header ── */}
        <header
          className="
            hidden h-16 shrink-0 items-center justify-between border-b
            border-chirp-border/50 bg-chirp-panel px-8
            lg:flex
          "
        >
          <div className="flex items-center gap-3">
            <h1 className="font-brand text-xl font-bold text-chirp-text">
              Images
            </h1>
            <Badge
              className="
                border-chirp-border/30 bg-chirp-surface text-chirp-text-body
              "
            >
              Photos
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="
                flex h-9 w-60 items-center gap-2 rounded-lg border
                border-chirp-border/28 bg-[#262126] px-3
              "
            >
              <Search size={16} className="text-chirp-text-faint" />
              <input
                className="
                  flex-1 bg-transparent text-sm text-chirp-text outline-none
                  placeholder:text-chirp-text-faint
                "
                placeholder="Search photos..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <Link to="/chirp/upload">
              <Button
                className="
                  h-9 gap-1.5 rounded-lg border border-chirp-border-warm/32
                  text-sm font-semibold text-white bg-chirp-gradient
                  hover:opacity-90
                "
              >
                <Upload size={14} />
                Upload
              </Button>
            </Link>
          </div>
        </header>

        {/* ── Desktop Filter Bar ── */}
        <div
          className="
            hidden h-11 shrink-0 items-center justify-between border-b
            border-chirp-border/50 bg-[#151318] px-6
            lg:flex
          "
        >
          <div className="flex items-center gap-2">
            <AddPersonDialog />

            {/* Selected person chips */}
            {selectedPeople.map((person) => (
              <PersonChip
                key={person.id}
                name={person.name}
                onClick={() => handlePersonClick(person.id)}
              />
            ))}

            {/* Manage */}
            <Button
              variant="outline"
              size="sm"
              className="
                h-7 gap-1.5 border-chirp-border/30 bg-chirp-surface
                text-chirp-text
                hover:bg-chirp-panel
              "
            >
              <Settings2 size={14} />
              Manage
            </Button>
          </div>

          <FaceOverlaySwitch
            id="face-overlay-desktop"
            checked={showOverlays}
            onCheckedChange={setShowOverlays}
            showIcon
          />
        </div>

        {/* ── Mobile Top Bar ── */}
        <header
          className="
            flex h-16 shrink-0 items-center justify-between border-b
            border-chirp-border/50 bg-chirp-panel px-4
            lg:hidden
          "
        >
          <div className="flex items-center gap-2">
            <ChirpLogo />
            <span className="font-brand text-lg font-bold text-chirp-text">
              Chirp
            </span>
          </div>
          <Link to="/chirp/upload">
            <Button
              size="sm"
              className="
                h-[34px] gap-1.5 rounded-lg border border-chirp-border-warm/32
                text-sm font-semibold text-white bg-chirp-gradient
              "
            >
              <Upload size={14} />
              Upload
            </Button>
          </Link>
        </header>

        {/* ── Mobile Search Row ── */}
        <div
          className="
            flex h-[52px] shrink-0 items-center gap-2 border-b
            border-chirp-border/50 px-3
            lg:hidden
          "
        >
          <Search size={16} className="text-chirp-text-faint" />
          <input
            className="
              flex-1 bg-transparent text-[13px] text-chirp-text outline-none
              placeholder:text-chirp-text-faint
            "
            placeholder="Search photos..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>

        {/* ── Mobile Filter Chips ── */}
        <div
          className="
            flex h-[50px] shrink-0 items-center gap-2 overflow-x-auto border-b
            border-chirp-border/50 px-3
            lg:hidden
          "
        >
          {selectedPeople.map((person) => (
            <PersonChip
              key={person.id}
              name={person.name}
              onClick={() => handlePersonClick(person.id)}
              size="sm"
            />
          ))}

          <FaceStateChip variant="tagged" />
          <FaceStateChip variant="likely" />
          <FaceStateChip variant="unknown" />
        </div>

        {/* ── Mobile Utility Row ── */}
        <div
          className="
            flex h-11 shrink-0 items-center justify-between border-b
            border-chirp-border/50 px-3
            lg:hidden
          "
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-chirp-text-body">
              Newest
            </span>
          </div>
          <div className="flex items-center gap-2">
            <MobileFilterSheet
              people={peopleList}
              sortBy={sortBy}
              onPersonClick={handlePersonClick}
              onClear={handleClearFilter}
            />
            <FaceOverlaySwitch
              id="face-overlay-mobile"
              checked={showOverlays}
              onCheckedChange={setShowOverlays}
            />
          </div>
        </div>

        {/* ── Photo Grid ── */}
        <ImageMasonry
          showFaceOverlays={showOverlays}
          sortPersonId={sortBy}
          search={search}
        />
      </div>

      <Outlet />
    </div>
  );
}
