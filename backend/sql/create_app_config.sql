create table portfolio.app_config (
  key text not null,
  value text not null,
  constraint app_config_pkey primary key (key)
) TABLESPACE pg_default;