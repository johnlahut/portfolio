import { useNavigate, useSearch } from '@tanstack/react-router';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { useCreatePerson, useDeletePerson, usePeople } from '../hooks';

export function PersonRow() {
  const { people } = usePeople();
  const { createPerson, createPersonLoading } = useCreatePerson();
  const { deletePerson } = useDeletePerson();

  const navigate = useNavigate({ from: '/chirp' });
  const { sortBy } = useSearch({ from: '/chirp' });

  const [name, setName] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const peopleList = people?.people ?? [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      createPerson(name.trim());
      setName('');
      setDialogOpen(false);
    }
  };

  const handlePersonClick = (personId: string) => {
    navigate({
      search: (prev) => ({
        ...prev,
        sortBy: sortBy === personId ? undefined : personId,
      }),
    });
  };

  return (
    <div className="flex gap-2 overflow-x-auto">
      <Dialog
        open={dialogOpen}
        onOpenChange={(isOpen) => {
          setDialogOpen(isOpen);
          if (!isOpen) setName('');
        }}
      >
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Person</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="Enter name..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>

            <Button
              type="submit"
              disabled={!name.trim() || createPersonLoading}
            >
              {createPersonLoading ? 'Adding...' : 'Add Person'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {peopleList.map((person) => (
        <ButtonGroup key={person.id}>
          <Button
            variant={sortBy === person.id ? 'default' : 'outline'}
            size="sm"
            onClick={() => handlePersonClick(person.id)}
          >
            {person.name}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setDeleteTarget({ id: person.id, name: person.name })
            }
            aria-label={`Delete ${person.name}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </ButtonGroup>
      ))}

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the person and unlink them from all tagged faces.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) deletePerson(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
