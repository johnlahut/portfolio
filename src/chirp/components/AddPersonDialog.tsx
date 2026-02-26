import { Plus } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { useCreatePerson } from '../hooks';

export function AddPersonDialog() {
  const { createPerson, createPersonLoading } = useCreatePerson();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      createPerson(name.trim());
      setName('');
      setOpen(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) setName('');
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="
            h-7 gap-1.5 border-chirp-border/30 bg-chirp-surface text-chirp-text
            hover:bg-chirp-panel
          "
        >
          <Plus size={14} />
          Add Person
        </Button>
      </DialogTrigger>
      <DialogContent className="border-chirp-border/40 bg-chirp-panel">
        <DialogHeader>
          <DialogTitle className="text-chirp-text">Add Person</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label className="text-chirp-text-body">Name</Label>
            <Input
              placeholder="Enter name..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="
                border-chirp-border/40 bg-chirp-bg text-chirp-text
                placeholder:text-chirp-text-faint
              "
            />
          </div>
          <Button
            type="submit"
            disabled={!name.trim() || createPersonLoading}
            className="
              bg-linear-[135deg] from-chirp-accent-start to-chirp-accent-end
              text-white
            "
          >
            {createPersonLoading ? 'Adding...' : 'Add Person'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
