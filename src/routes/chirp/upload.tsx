import { Link, createFileRoute, redirect } from '@tanstack/react-router';
import { ArrowLeft, Link2 } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { GallerySidebar } from '~/chirp/components/GallerySidebar';
import { ScrapeJobTable } from '~/chirp/components/ScrapeJobTable';
import {
  checkAuthOptions,
  useCreateScrapeJob,
  useDeleteScrapeJob,
  useRetryScrapeJob,
  useScrapeJobs,
} from '~/chirp/hooks';

/* ------------------------------------------------------------------ */
/*  Route config                                                       */
/* ------------------------------------------------------------------ */

export const Route = createFileRoute('/chirp/upload')({
  component: RouteComponent,
  beforeLoad: async ({ context: { queryClient } }) => {
    const authenticated = await queryClient.ensureQueryData(checkAuthOptions);
    if (!authenticated) {
      throw redirect({ to: '/chirp/login' });
    }
  },
});

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

function RouteComponent() {
  const [url, setUrl] = useState('');

  const { scrapeJobs, scrapeJobsLoading } = useScrapeJobs();
  const { createScrapeJob, createScrapeJobPending } = useCreateScrapeJob();
  const { retryScrapeJob, retryScrapeJobPending } = useRetryScrapeJob();
  const { deleteScrapeJob, deleteScrapeJobPending } = useDeleteScrapeJob();

  const jobs = scrapeJobs ?? [];

  const totalImages = jobs.reduce((acc, j) => acc + (j.total_images ?? 0), 0);
  const totalFaces = jobs.reduce((acc, j) => acc + j.total_faces, 0);
  const activeJobs = jobs.filter(
    (j) =>
      j.status === 'pending' ||
      j.status === 'scraping' ||
      j.status === 'processing',
  ).length;

  const handleScrape = () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    createScrapeJob(trimmed, { onSuccess: () => setUrl('') });
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-chirp-bg font-sans">
      {/* Sidebar */}
      <GallerySidebar />

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header
          className="
            hidden h-16 shrink-0 items-center justify-between border-b
            border-chirp-border/50 bg-chirp-panel px-8
            lg:flex
          "
        >
          <div>
            <h1 className="font-brand text-xl font-bold text-chirp-text">
              Website Photo Scraper
            </h1>
            <p className="text-xs text-chirp-text-body">
              Paste a URL to scrape and process all images found on the page
            </p>
          </div>
        </header>

        {/* URL input bar */}
        <div
          className="
            shrink-0 border-b border-chirp-border/50 bg-[#151318] px-8 py-4
          "
        >
          <div className="flex gap-2">
            <Link to="/chirp/gallery">
              <Button
                variant={'ghost'}
                className="
                  h-9 text-sm
                  lg:hidden
                "
              >
                <ArrowLeft size={14} />
                Back
              </Button>
            </Link>
            <div className="relative flex-1">
              <Link2
                size={16}
                className="
                  absolute top-1/2 left-3 -translate-y-1/2 text-chirp-text-faint
                "
              />
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleScrape()}
                placeholder="https://example.com/gallery"
                className="
                  h-9 border-chirp-border/28 bg-[#262126] pl-9 text-sm
                  text-chirp-text
                  placeholder:text-chirp-text-faint
                  focus-visible:border-chirp-accent/50
                "
              />
            </div>
            <Button
              onClick={handleScrape}
              disabled={!url.trim() || createScrapeJobPending}
              className="
                h-9 gap-1.5 rounded-lg border border-chirp-border-warm/32
                bg-linear-[135deg] from-[#D3925B] to-[#AE6F42] text-sm
                font-semibold text-white
                hover:opacity-90
                disabled:opacity-50
              "
            >
              Scrape
            </Button>
          </div>

          {/* Summary chips */}
          {!scrapeJobsLoading && jobs.length > 0 && (
            <div className="mt-3 flex items-center gap-2">
              <Badge
                className="
                  border-chirp-border/30 bg-chirp-surface text-chirp-text-body
                "
              >
                {jobs.length} {jobs.length === 1 ? 'job' : 'jobs'}
              </Badge>
              {activeJobs > 0 && (
                <Badge className="border-amber-400/36 bg-[#382916] text-amber-300">
                  {activeJobs} active
                </Badge>
              )}
              <Badge
                className="
                  border-chirp-border/30 bg-chirp-surface text-chirp-text-body
                "
              >
                {totalImages} images
              </Badge>
              <Badge
                className="
                  border-chirp-border/30 bg-chirp-surface text-chirp-text-body
                "
              >
                {totalFaces} faces
              </Badge>
            </div>
          )}
        </div>

        {/* Jobs table */}
        <div className="flex-1 overflow-auto">
          <ScrapeJobTable
            jobs={jobs}
            onRetry={retryScrapeJob}
            onDelete={deleteScrapeJob}
            retryPending={retryScrapeJobPending}
            deletePending={deleteScrapeJobPending}
          />
        </div>
      </div>
    </div>
  );
}
