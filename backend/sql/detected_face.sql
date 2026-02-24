create table portfolio.detected_face (
  id uuid not null default gen_random_uuid (),
  created_at timestamp with time zone not null default now(),
  image_id uuid null,
  encoding portfolio.vector not null,
  location_top smallint not null,
  location_right smallint not null,
  location_bottom smallint not null,
  location_left smallint not null,
  person_id uuid null,
  matched_at timestamp without time zone null,
  constraint detected_face_pkey primary key (id),
  constraint detected_face_image_id_fkey foreign KEY (image_id) references portfolio.image (id) on delete CASCADE,
  constraint detected_face_person_id_fkey foreign KEY (person_id) references portfolio.person (id) on delete set null
) TABLESPACE pg_default;

create index IF not exists detected_face_encoding_idx on portfolio.detected_face using ivfflat (encoding) TABLESPACE pg_default;