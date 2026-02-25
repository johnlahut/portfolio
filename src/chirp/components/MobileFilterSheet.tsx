import { SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';

import type { Person } from '../types';

type MobileFilterSheetProps = {
  people: Person[];
  sortBy?: string;
  showOverlays: boolean;
  onPersonClick: (personId: string) => void;
  onOverlaysChange: (value: boolean) => void;
  onClear: () => void;
};

export function MobileFilterSheet({
  people,
  sortBy,
  showOverlays,
  onPersonClick,
  onOverlaysChange,
  onClear,
}: MobileFilterSheetProps) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-chirp-text-body"
        >
          <SlidersHorizontal size={14} />
          Filters
        </Button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="
          rounded-t-2xl border-t border-chirp-border/50 bg-(--chirp-sheet-bg)
        "
      >
        <SheetHeader>
          <SheetTitle className="text-chirp-text">Filter Photos</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-4 p-4">
          {/* People */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-chirp-text-dim">
              People
            </span>
            <div className="flex flex-wrap gap-2">
              {people.map((person) => (
                <button
                  key={person.id}
                  onClick={() => onPersonClick(person.id)}
                  className={`
                    rounded-full border px-3 py-1 text-xs
                    ${
                      sortBy === person.id
                        ? `
                          border-(--chirp-selected-bg)/50
                          bg-(--chirp-selected-bg)/20 text-(--chirp-selected-fg)
                        `
                        : 'border-chirp-border/40 text-chirp-text-body'
                    }
                  `}
                >
                  {person.name}
                </button>
              ))}
            </div>
          </div>

          {/* Face Overlay */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-chirp-text-dim">
              Face Overlay
            </span>
            <Switch
              checked={showOverlays}
              onCheckedChange={onOverlaysChange}
              size="sm"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1 border-chirp-border/40 text-chirp-text-body"
              onClick={() => {
                onClear();
                setOpen(false);
              }}
            >
              Clear
            </Button>
            <Button
              className="flex-1 font-semibold text-white bg-chirp-gradient"
              onClick={() => setOpen(false)}
            >
              Apply
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
