create table portfolio.person (
  id uuid not null default gen_random_uuid (),
  created_at timestamp with time zone not null default now(),
  name text not null,
  constraint person_pkey primary key (id)
) TABLESPACE pg_default;