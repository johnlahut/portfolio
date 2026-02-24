import { RotateCcw, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import type { ScrapeJob } from '../types';
import { ScrapeStatusChip } from './ScrapeStatusChip';

type ScrapeJobTableProps = {
  jobs: ScrapeJob[];
  onRetry: (jobId: string) => void;
  onDelete: (jobId: string) => void;
  retryPending: boolean;
  deletePending: boolean;
};

export function ScrapeJobTable({
  jobs,
  onRetry,
  onDelete,
  retryPending,
  deletePending,
}: ScrapeJobTableProps) {
  if (jobs.length === 0) {
    return (
      <div
        className="
        flex flex-col items-center justify-center py-20 text-chirp-text-dim
      "
      >
        <p className="text-sm">No scrape jobs yet.</p>
        <p className="mt-1 text-xs text-chirp-text-faint">
          Paste a URL above and click Scrape to get started.
        </p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader className="bg-chirp-panel">
        <TableRow
          className="
          border-chirp-border/20
          hover:bg-transparent
        "
        >
          <TableHead className="w-16 px-4 text-chirp-text-muted">
            Preview
          </TableHead>
          <TableHead className="px-4 text-chirp-text-muted">
            Source URL
          </TableHead>
          <TableHead className="w-20 px-4 text-chirp-text-muted">
            Images
          </TableHead>
          <TableHead className="w-20 px-4 text-chirp-text-muted">
            Faces
          </TableHead>
          <TableHead className="w-28 px-4 text-chirp-text-muted">
            Status
          </TableHead>
          <TableHead className="w-24 px-4 text-chirp-text-muted">
            Actions
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {jobs.map((job) => (
          <TableRow
            key={job.id}
            className="
              border-chirp-border/20 bg-chirp-grid
              hover:bg-chirp-panel/50
            "
          >
            <TableCell className="px-4 py-3">
              {job.preview_url ? (
                <img
                  src={job.preview_url}
                  alt=""
                  className="
                    h-10 w-14 rounded-lg border border-chirp-border/30
                    bg-chirp-surface object-cover
                  "
                />
              ) : (
                <div
                  className="
                  h-10 w-14 rounded-lg border border-chirp-border/30
                  bg-chirp-surface
                "
                />
              )}
            </TableCell>

            <TableCell className="px-4 py-3">
              <p
                className="max-w-xs truncate font-medium text-chirp-text"
                title={job.url}
              >
                {job.url}
              </p>
              <p className="mt-0.5 text-[11px] text-chirp-text-dim">
                {new Date(job.created_at).toLocaleDateString()}
              </p>
            </TableCell>

            <TableCell className="px-4 py-3 text-chirp-text-body">
              {job.total_images != null ? (
                <span>
                  {job.processed_count + job.skipped_count}/{job.total_images}
                </span>
              ) : (
                <span className="text-chirp-text-dim">—</span>
              )}
            </TableCell>

            <TableCell className="px-4 py-3 text-chirp-text-body">
              {job.total_faces > 0 ? (
                job.total_faces
              ) : (
                <span className="text-chirp-text-dim">—</span>
              )}
            </TableCell>

            <TableCell className="px-4 py-3">
              <ScrapeStatusChip status={job.status} />
              {job.error && job.status !== 'completed' && (
                <p
                  className="
                    mt-1 max-w-[160px] truncate text-[10px] text-rose-400
                  "
                  title={job.error}
                >
                  {job.error}
                </p>
              )}
            </TableCell>

            <TableCell className="px-4 py-3">
              <div className="flex items-center gap-1">
                {job.status === 'failed' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="
                      h-7 gap-1 px-2 text-xs text-chirp-text-body
                      hover:text-chirp-text
                    "
                    onClick={() => onRetry(job.id)}
                    disabled={retryPending}
                  >
                    <RotateCcw size={12} />
                    Retry
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="
                    h-7 w-7 p-0 text-chirp-text-dim
                    hover:text-rose-400
                  "
                  onClick={() => onDelete(job.id)}
                  disabled={deletePending}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
