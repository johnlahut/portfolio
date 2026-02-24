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