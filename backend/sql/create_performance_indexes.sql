-- Performance indexes for the person-sort query path.
-- Run in Supabase SQL editor.
--
-- IMPORTANT: These should be run during low traffic. The CONCURRENTLY option
-- avoids locking the table but takes longer to build.

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ 1. B-tree on detected_face.image_id                                       │
-- │                                                                           │
-- │ Critical for EVERY query that joins faces to images.                       │
-- │ PostgreSQL does NOT auto-create indexes for foreign key columns.           │
-- │ Without this, every LEFT JOIN detected_face ON image_id = ... is a        │
-- │ sequential scan of the entire detected_face table.                        │
-- └─────────────────────────────────────────────────────────────────────────────┘
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_detected_face_image_id
    ON portfolio.detected_face (image_id);


-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ 2. Composite index on (person_id, image_id) — partial, assigned only      │
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
-- └─────────────────────────────────────────────────────────────────────────────┘
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_detected_face_person_image
    ON portfolio.detected_face (person_id, image_id)
    WHERE person_id IS NOT NULL;


-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ 3. Composite index for default-sort pagination                            │
-- │                                                                           │
-- │ Covers ORDER BY created_at DESC, id ASC with the source_url IS NOT NULL   │
-- │ filter. Allows the paginated query to use an index scan instead of        │
-- │ sorting all rows in memory.                                               │
-- │                                                                           │
-- │ Partial (WHERE source_url IS NOT NULL) matches the query's WHERE clause   │
-- │ so the index is smaller and the planner can use it directly.              │
-- └─────────────────────────────────────────────────────────────────────────────┘
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_image_created_at_id
    ON portfolio.image (created_at DESC, id)
    WHERE source_url IS NOT NULL;


-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ 4. Vector index with correct operator class                               │
-- │                                                                           │
-- │ The existing detected_face_encoding_idx was created without specifying     │
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
-- └─────────────────────────────────────────────────────────────────────────────┘
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_detected_face_encoding_cosine
    ON portfolio.detected_face
    USING hnsw (encoding vector_cosine_ops)
    WITH (m = 16, ef_construction = 200);


-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ Verification queries                                                      │
-- │                                                                           │
-- │ Run these after creating indexes to confirm they exist:                   │
-- │                                                                           │
-- │   SELECT indexname, indexdef                                              │
-- │   FROM pg_indexes                                                         │
-- │   WHERE schemaname = 'portfolio'                                          │
-- │   ORDER BY tablename, indexname;                                          │
-- │                                                                           │
-- │ To check if the vector index is being used:                               │
-- │                                                                           │
-- │   EXPLAIN (ANALYZE, BUFFERS)                                              │
-- │   SELECT id FROM portfolio.detected_face                                  │
-- │   ORDER BY encoding <=> (                                                 │
-- │       SELECT encoding FROM portfolio.detected_face LIMIT 1               │
-- │   )                                                                       │
-- │   LIMIT 10;                                                               │
-- │                                                                           │
-- │ You should see "Index Scan using idx_detected_face_encoding_cosine"       │
-- │ in the output. If you see "Seq Scan", the index isn't being used.         │
-- └─────────────────────────────────────────────────────────────────────────────┘
