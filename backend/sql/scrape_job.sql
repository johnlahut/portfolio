create table portfolio.scrape_job (
  id uuid not null default gen_random_uuid (),
  url text not null,
  status text not null default 'pending'::text,
  total_images integer null,
  processed_count integer not null default 0,
  skipped_count integer not null default 0,
  failed_count integer not null default 0,
  total_faces integer not null default 0,
  preview_url text null,
  error text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint scrape_job_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists idx_scrape_job_status on portfolio.scrape_job using btree (status) TABLESPACE pg_default;

create index IF not exists idx_scrape_job_created_at on portfolio.scrape_job using btree (created_at desc) TABLESPACE pg_default;