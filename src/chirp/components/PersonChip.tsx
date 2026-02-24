import { X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type PersonChipProps = {
  name: string;
  onClick: () => void;
  size?: 'sm' | 'md';
  className?: string;
};

export function PersonChip({
  name,
  onClick,
  size = 'md',
  className,
}: PersonChipProps) {
  return (
    <Badge
      asChild
      className={cn(
        `
          cursor-pointer gap-1.5 rounded-full bg-(--chirp-selected-bg)
          font-medium text-(--chirp-selected-fg)
        `,
        size === 'md'
          ? 'h-8 py-1 pr-3 pl-1 text-sm'
          : `
          h-[30px] py-1 pr-2.5 pl-1 text-sm
        `,
        className,
      )}
    >
      <button onClick={onClick}>
        <X
          size={size === 'md' ? 14 : 12}
          className="rounded-full bg-white/20 p-0.5"
        />
        {name}
      </button>
    </Badge>
  );
}
