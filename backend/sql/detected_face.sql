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

-- Performance indexes for the person-sort query path.
-- Run in Supabase SQL editor.
--
-- IMPORTANT: These should be run during low traffic. The CONCURRENTLY option
-- avoids locking the table but takes longer to build.

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │  B-tree on detected_face.image_id                                           │
-- │                                                                             │
-- │ Critical for EVERY query that joins faces to images.                        │
-- │ PostgreSQL does NOT auto-create indexes for foreign key columns.            │
-- │ Without this, every LEFT JOIN detected_face ON image_id = ... is a          │
-- │ sequential scan of the entire detected_face table.                          │
-- └─────────────────────────────────────────────────────────────────────────────┘
CREATE INDEX IF NOT EXISTS idx_detected_face_image_id
    ON portfolio.detected_face (image_id);


-- ┌───────────────────────────────────────────────────────────────────────────┐
-- │ Composite index on (person_id, image_id) — partial, assigned only         │
-- │                                                                           │
-- │ Covers two hot query patterns:                                            │
-- │   a) "Which images have a face tagged for person X?"                      │
-- │      → SELECT DISTINCT image_id WHERE person_id = X                       │
-- │      → index-only scan on the leading column                              │
-- │   b) "Find all reference face encodings for person X"                     │
-- │      → WHERE person_id = X (prefix scan)                                  │
-- │                                                                           │
-- │ Partial (WHERE person_id IS NOT NULL) keeps the index small — most faces  │
-- │ are unassigned. Also serves the LATERAL join's                            │
-- │ "WHERE ref.person_id IS NOT NULL" filter.                                 │
-- └───────────────────────────────────────────────────────────────────────────┘
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_detected_face_person_image
    ON portfolio.detected_face (person_id, image_id)
    WHERE person_id IS NOT NULL;

-- ┌───────────────────────────────────────────────────────────────────────────┐
-- │ Vector index with correct operator class                                  │
-- │                                                                           │
-- │ The existing detected_face_encoding_idx was created without specifying    │
-- │ an operator class, so it defaults to vector_l2_ops (L2/Euclidean, <->).   │
-- │ But ALL queries use the <=> operator (cosine distance).                   │
-- │                                                                           │
-- │ Result: the vector index is COMPLETELY UNUSED. Every distance computation │
-- │ falls back to brute-force sequential scan.                                │
-- │                                                                           │
-- │ Fix: create a new index with vector_cosine_ops.                           │
-- │                                                                           │
-- │ HNSW is preferred over IVFFlat here because:                              │
-- │   - Better recall (accuracy) at equivalent speed                          │
-- │   - Handles filtered queries better (WHERE person_id IS NOT NULL)         │
-- │   - No lists/probes tuning required                                       │
-- │   - Concurrent insert support                                             │
-- │                                                                           │
-- │ After verifying the new index works, drop the old one:                    │
-- │   DROP INDEX IF EXISTS portfolio.detected_face_encoding_idx;              │
-- └───────────────────────────────────────────────────────────────────────────┘
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_detected_face_encoding_cosine
    ON portfolio.detected_face
    USING hnsw (encoding vector_cosine_ops)
    WITH (m = 16, ef_construction = 200);