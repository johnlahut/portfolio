create table portfolio.scrape_job_item (
  id uuid not null default gen_random_uuid (),
  job_id uuid not null,
  source_url text not null,
  status text not null default 'queued'::text,
  image_id uuid null,
  error text null,
  created_at timestamp with time zone not null default now(),
  constraint scrape_job_item_pkey primary key (id),
  constraint scrape_job_item_image_id_fkey foreign KEY (image_id) references portfolio.image (id),
  constraint scrape_job_item_job_id_fkey foreign KEY (job_id) references portfolio.scrape_job (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_scrape_job_item_job_id on portfolio.scrape_job_item using btree (job_id) TABLESPACE pg_default;