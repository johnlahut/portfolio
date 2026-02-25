import { Link, useRouterState } from '@tanstack/react-router';
import { Check, Circle, Image, Upload } from 'lucide-react';

import { cn } from '@/lib/utils';

import type { Person } from '../types';
import { ChirpLogo } from './ChirpLogo';

type GallerySidebarProps = {
  people?: Person[];
  sortBy?: string;
  onPersonClick?: (personId: string) => void;
  onClearFilter?: () => void;
};

const navCls = (active: boolean) =>
  cn(
    'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
    active
      ? 'border border-chirp-border-warm/18 bg-chirp-card text-chirp-text'
      : `
        text-chirp-text-body
        hover:bg-chirp-panel
      `,
  );

export function GallerySidebar({
  people = [],
  sortBy,
  onPersonClick,
  onClearFilter,
}: GallerySidebarProps) {
  const { location } = useRouterState();
  const isUploads = location.pathname.startsWith('/chirp/upload');
  const isAllPhotosActive = !isUploads && !sortBy;

  return (
    <aside
      className="
        hidden w-64 shrink-0 flex-col border-r border-chirp-border/25
        bg-chirp-sidebar p-2
        lg:flex
      "
    >
      {/* Brand header */}
      <Link to="/chirp">
        <div className="flex items-center gap-2 rounded-md bg-chirp-panel p-2">
          <ChirpLogo />
          <div className="flex flex-col">
            <span className="font-brand text-base/tight font-bold text-chirp-text">
              Chirp
            </span>
            <span className="text-xs text-chirp-text-body">Daycare Photos</span>
          </div>
        </div>
      </Link>

      {/* Nav content */}
      <nav className="mt-4 flex flex-1 flex-col gap-1">
        <span className="px-2 py-1.5 text-xs font-medium text-chirp-text-dim">
          Library
        </span>
        <Link
          to="/chirp/gallery"
          search={undefined}
          onClick={() => onClearFilter?.()}
          className={navCls(isAllPhotosActive)}
        >
          <Image size={16} />
          All Photos
        </Link>

        <Link to="/chirp/upload" className={navCls(isUploads)}>
          <Upload size={16} />
          Uploads
        </Link>

        {/* People section */}
        {people.length > 0 && (
          <>
            <span
              className="
                mt-4 px-2 py-1.5 text-xs font-medium text-chirp-text-dim
              "
            >
              People Filters
            </span>
            {people.map((person) => (
              <button
                key={person.id}
                onClick={() => onPersonClick?.(person.id)}
                className={navCls(sortBy === person.id)}
              >
                {sortBy === person.id ? (
                  <Check size={16} className="text-chirp-accent" />
                ) : (
                  <Circle size={16} />
                )}
                {person.name}
              </button>
            ))}
          </>
        )}
      </nav>
    </aside>
  );
}
