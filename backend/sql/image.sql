create table portfolio.image (
  id uuid not null default gen_random_uuid (),
  created_at timestamp with time zone not null default now(),
  source_url text not null,
  filename text not null,
  width integer null,
  height integer null,
  constraint image_pkey primary key (id),
  constraint image_source_url_key unique (source_url)
) TABLESPACE pg_default;

-- ┌───────────────────────────────────────────────────────────────────────────┐
-- │ Composite index for default-sort pagination                               │
-- │                                                                           │
-- │ Covers ORDER BY created_at DESC, id ASC with the source_url IS NOT NULL   │
-- │ filter. Allows the paginated query to use an index scan instead of        │
-- │ sorting all rows in memory.                                               │
-- │                                                                           │
-- │ Partial (WHERE source_url IS NOT NULL) matches the query's WHERE clause   │
-- │ so the index is smaller and the planner can use it directly.              │
-- └───────────────────────────────────────────────────────────────────────────┘
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_image_created_at_id
    ON portfolio.image (created_at DESC, id)
    WHERE source_url IS NOT NULL;