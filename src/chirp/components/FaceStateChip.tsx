import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const variants = {
  tagged:
    'border-(--face-tagged)/33 bg-(--face-tagged-label-bg) text-(--face-tagged-label-fg)',
  likely:
    'border-(--face-likely)/36 bg-(--face-likely-label-bg) text-(--face-likely-label-fg)',
  unknown:
    'border-(--face-unknown)/36 bg-(--face-unknown-label-bg) text-(--face-unknown-label-fg)',
} as const;

const defaultLabels = {
  tagged: 'Tagged',
  likely: 'Likely',
  unknown: 'Unknown',
};

type FaceStateChipProps = {
  variant: keyof typeof variants;
  label?: string;
  className?: string;
};

export function FaceStateChip({
  variant,
  label,
  className,
}: FaceStateChipProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'h-[22px] rounded-full px-2 text-[11px] font-medium',
        variants[variant],
        className,
      )}
    >
      {label ?? defaultLabels[variant]}
    </Badge>
  );
}
