import { Check, Plus } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

import { useCreatePerson, usePeople } from '../hooks';
import type { DetectedFace, Person } from '../types';

type OverlayPersonSelectProps = {
  face: DetectedFace;
  scaleX: number;
  scaleY: number;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onPersonSelect?: (face: DetectedFace, person: Person | null) => void;
};

export function OverlayPersonSelect({
  face,
  scaleX,
  scaleY,
  isOpen,
  onOpenChange,
  onPersonSelect,
}: OverlayPersonSelectProps) {
  const { people } = usePeople();
  const { createPerson, createPersonLoading } = useCreatePerson();
  const [isCreating, setIsCreating] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');

  const peopleList = people?.people ?? [];
  const assignedPersonId = face.person_id;
  const assignedPerson = peopleList.find((p) => p.id === assignedPersonId);
  const defaultValue = assignedPerson?.name ?? '';

  const handleSelect = (person: Person | null) => {
    onPersonSelect?.(face, person);
    onOpenChange(false);
  };

  const handleCreatePerson = () => {
    if (!newPersonName.trim()) return;

    createPerson(newPersonName.trim(), {
      onSuccess: (data) => {
        setNewPersonName('');
        setIsCreating(false);
        onPersonSelect?.(face, data.person);
        onOpenChange(false);
      },
    });
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setIsCreating(false);
      setNewPersonName('');
    }
    onOpenChange(open);
  };

  // Calculate position based on face location
  const x = face.location_left * scaleX;
  const y = face.location_top * scaleY;
  const height = (face.location_bottom - face.location_top) * scaleY;

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <div
          className="absolute"
          style={{
            left: x,
            top: y + height + 4,
            width: 1,
            height: 1,
          }}
        />
      </PopoverTrigger>
      <PopoverContent className="w-50 p-0" align="start" side="bottom">
        {isCreating ? (
          <div className="space-y-2 p-2">
            <Input
              placeholder="Enter name..."
              value={newPersonName}
              onChange={(e) => setNewPersonName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCreatePerson();
                } else if (e.key === 'Escape') {
                  setIsCreating(false);
                  setNewPersonName('');
                }
              }}
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1"
                onClick={handleCreatePerson}
                disabled={!newPersonName.trim() || createPersonLoading}
              >
                {createPersonLoading ? 'Creating...' : 'Create'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setIsCreating(false);
                  setNewPersonName('');
                }}
              >
                Cancel
              </Button>
            </div>
            {/* {createPerson.isError && (
              <p className="text-xs text-destructive">
                {createPerson.error?.message}
              </p>
            )} */}
          </div>
        ) : (
          <Command defaultValue={defaultValue}>
            <CommandInput placeholder="Search people..." />
            <CommandList>
              <CommandEmpty>No person found.</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  onSelect={() => handleSelect(null)}
                  className="text-muted-foreground"
                >
                  <Check
                    className={cn(
                      'mr-2 size-4',
                      !assignedPersonId ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  Unassigned
                </CommandItem>
                {peopleList.map((person) => (
                  <CommandItem
                    key={person.id}
                    value={person.name}
                    onSelect={() => handleSelect(person)}
                  >
                    <Check
                      className={cn(
                        'mr-2 size-4',
                        assignedPersonId === person.id
                          ? 'opacity-100'
                          : 'opacity-0',
                      )}
                    />
                    {person.name}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup>
                <CommandItem onSelect={() => setIsCreating(true)}>
                  <Plus className="mr-2 size-4" />
                  Create new person
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        )}
      </PopoverContent>
    </Popover>
  );
}
