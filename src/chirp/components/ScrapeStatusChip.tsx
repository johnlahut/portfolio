import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const variants: Record<string, string> = {
  queued: 'border-chirp-border/30 bg-chirp-surface text-chirp-text-body',
  pending: 'border-chirp-border/30 bg-chirp-surface text-chirp-text-body',
  scraping:
    'border-(--face-likely)/36 bg-(--face-likely-label-bg) text-(--face-likely-label-fg)',
  processing:
    'border-(--face-likely)/36 bg-(--face-likely-label-bg) text-(--face-likely-label-fg)',
  completed:
    'border-(--face-tagged)/33 bg-(--face-tagged-label-bg) text-(--face-tagged-label-fg)',
  skipped: 'border-chirp-border/30 bg-chirp-surface text-chirp-text-dim',
  failed: 'border-destructive/36 bg-destructive/10 text-destructive',
};

const labels: Record<string, string> = {
  queued: 'Queued',
  pending: 'Pending',
  scraping: 'Scraping',
  processing: 'Processing',
  completed: 'Done',
  skipped: 'Skipped',
  failed: 'Failed',
};

type ScrapeStatusChipProps = {
  status: string;
  className?: string;
};

export function ScrapeStatusChip({ status, className }: ScrapeStatusChipProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'h-[22px] rounded-full px-2 text-[11px] font-medium',
        variants[status] ?? variants.queued,
        className,
      )}
    >
      {labels[status] ?? status}
    </Badge>
  );
}
