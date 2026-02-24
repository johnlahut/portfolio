-- ── scrape_job ───────────────────────────────────────────────────────────────
-- One row per submitted page URL. Tracks overall job status and aggregate counts.

CREATE TABLE IF NOT EXISTS portfolio.scrape_job (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    url             text        NOT NULL,
    status          text        NOT NULL DEFAULT 'pending',
    -- status values: pending | scraping | processing | completed | failed
    total_images    int,
    processed_count int         NOT NULL DEFAULT 0,
    skipped_count   int         NOT NULL DEFAULT 0,
    failed_count    int         NOT NULL DEFAULT 0,
    total_faces     int         NOT NULL DEFAULT 0,
    preview_url     text,
    error           text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scrape_job_status
    ON portfolio.scrape_job (status);

CREATE INDEX IF NOT EXISTS idx_scrape_job_created_at
    ON portfolio.scrape_job (created_at DESC);


-- ── scrape_job_item ──────────────────────────────────────────────────────────
-- Thin tracking row per discovered image URL.
-- All rich image data (faces, dimensions) lives in the existing `image` table.

CREATE TABLE IF NOT EXISTS portfolio.scrape_job_item (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id      uuid        NOT NULL
                    REFERENCES portfolio.scrape_job (id) ON DELETE CASCADE,
    source_url  text        NOT NULL,
    status      text        NOT NULL DEFAULT 'queued',
    -- status values: queued | processing | completed | skipped | failed
    image_id    uuid        REFERENCES portfolio.image (id),
    error       text,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scrape_job_item_job_id
    ON portfolio.scrape_job_item (job_id);


-- ── increment_scrape_job ─────────────────────────────────────────────────────
-- Atomic counter increment used by the background worker (avoids read-modify-write races).

CREATE OR REPLACE FUNCTION portfolio.increment_scrape_job(
    p_job_id uuid,
    p_column text,
    p_amount int DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    EXECUTE format(
        'UPDATE portfolio.scrape_job
            SET %I = COALESCE(%I, 0) + $1, updated_at = now()
          WHERE id = $2',
        p_column, p_column
    )
    USING p_amount, p_job_id;
END;
$$;
