-- RPC function to get a single image with detected faces and their top N closest person matches
-- Matches are found by comparing face encodings against other detected faces that have been assigned to a person
-- Run this in Supabase SQL editor

CREATE OR REPLACE FUNCTION portfolio.get_image_with_person_matches(
    p_image_id UUID,
    p_threshold FLOAT DEFAULT 0.5,
    p_top_n INT DEFAULT 3
)
RETURNS TABLE (
    image_id UUID,
    filename TEXT,
    source_url TEXT,
    width INT,
    height INT,
    face_id UUID,
    face_encoding vector(512),
    location_top INT,
    location_right INT,
    location_bottom INT,
    location_left INT,
    assigned_person_id UUID,
    matched_person_id UUID,
    matched_person_name TEXT,
    match_distance FLOAT
)
LANGUAGE SQL
STABLE
AS $$
    SELECT
        i.id AS image_id,
        i.filename,
        i.source_url,
        i.width,
        i.height,
        df.id AS face_id,
        df.encoding AS face_encoding,
        df.location_top,
        df.location_right,
        df.location_bottom,
        df.location_left,
        df.person_id AS assigned_person_id,
        matches.person_id AS matched_person_id,
        matches.person_name AS matched_person_name,
        matches.distance AS match_distance
    FROM portfolio.image i
    LEFT JOIN portfolio.detected_face df ON df.image_id = i.id
    LEFT JOIN LATERAL (
        -- Find persons by matching against detected faces that have been assigned to a person
        -- Self-matching is allowed so tagged faces get distance 0 for their assigned person
        SELECT
            p.id AS person_id,
            p.name AS person_name,
            MIN(df.encoding <=> ref.encoding) AS distance
        FROM portfolio.detected_face ref
        JOIN portfolio.person p ON p.id = ref.person_id
        WHERE ref.person_id IS NOT NULL
          AND df.encoding <=> ref.encoding < p_threshold
        GROUP BY p.id, p.name
        ORDER BY distance
        LIMIT p_top_n
    ) matches ON true
    WHERE i.id = p_image_id;
$$;

-- RPC function to get paginated images with detected faces and their top N closest person matches.
--
-- Supports:
--   - Cursor-based pagination (keyset) for stable, efficient paging
--   - Default sort: created_at DESC, id ASC (newest first)
--   - Person sort: is_tagged DESC, min_distance ASC NULLS LAST, id ASC
--   - Full-text search on source_url and filename
--
-- Cursor fields:
--   Default sort: p_cursor_created_at + p_cursor_id
--   Person sort:  p_cursor_is_tagged + p_cursor_min_distance + p_cursor_id
--
-- Returns p_limit + 1 image rows so the caller can detect whether a next page exists.
-- The caller should trim to p_limit and build next_cursor from the extra row's sort fields.
--
-- Performance notes:
--   Requires these indexes (see create_performance_indexes.sql):
--     - idx_detected_face_image_id          (image_id)
--     - idx_detected_face_person_image      (person_id, image_id) WHERE person_id IS NOT NULL
--     - idx_image_created_at_id             (created_at DESC, id) WHERE source_url IS NOT NULL
--     - idx_detected_face_encoding_cosine   HNSW (encoding vector_cosine_ops)
--
--   The person-sort path pre-computes sort metrics via flat CTEs instead of
--   correlated subqueries. This allows hash joins and parallel execution.
--   When person sort is inactive (p_sort_person_id IS NULL), the helper CTEs
--   short-circuit to zero rows and add negligible overhead.
CREATE OR REPLACE FUNCTION portfolio.get_all_images_with_person_matches(
    p_threshold FLOAT DEFAULT 0.5,
    p_top_n INT DEFAULT 3,
    p_limit INT DEFAULT 40,
    p_cursor_created_at TIMESTAMPTZ DEFAULT NULL,
    p_cursor_id UUID DEFAULT NULL,
    p_sort_person_id UUID DEFAULT NULL,
    p_cursor_is_tagged INT DEFAULT NULL,
    p_cursor_min_distance FLOAT DEFAULT NULL,
    p_search TEXT DEFAULT NULL
)
RETURNS TABLE (
    image_id UUID,
    filename TEXT,
    source_url TEXT,
    width INT,
    height INT,
    created_at TIMESTAMPTZ,
    sort_is_tagged INT,
    sort_min_distance FLOAT,
    face_id UUID,
    face_encoding vector(512),
    location_top INT,
    location_right INT,
    location_bottom INT,
    location_left INT,
    assigned_person_id UUID,
    matched_person_id UUID,
    matched_person_name TEXT,
    match_distance FLOAT
)
LANGUAGE SQL
STABLE
AS $$
    WITH
    -- ── Person-sort helper CTEs ────────────────────────────────────────────
    -- These short-circuit to zero rows when p_sort_person_id IS NULL,
    -- adding no overhead to the default-sort path.

    ref_faces AS (
        -- Reference face encodings for the sort person (typically 1-30 rows).
        -- Used by image_min_distances below.
        SELECT encoding
        FROM portfolio.detected_face
        WHERE person_id = p_sort_person_id
    ),

    tagged_image_ids AS (
        -- Images where at least one face is manually tagged for the sort person.
        -- Fast index-only scan via idx_detected_face_person_image.
        SELECT DISTINCT image_id
        FROM portfolio.detected_face
        WHERE person_id = p_sort_person_id
    ),

    image_min_distances AS (
        -- Per-image minimum cosine distance to any of the sort person's faces.
        --
        -- KEY OPTIMIZATION: This replaces the old correlated subquery that ran
        -- a CROSS JOIN inside a scalar subquery for EACH image row (nested loop,
        -- no parallelism). The flat CTE allows PostgreSQL to:
        --   1. Scan detected_face once (not N times)
        --   2. Use a hash join with the small ref_faces set
        --   3. Hash-aggregate by image_id
        --   4. Optionally parallelize the scan
        --
        -- Total distance computations are the same (F_total x R_ref), but the
        -- execution plan is dramatically more efficient.
        SELECT
            df.image_id,
            MIN(df.encoding <=> rf.encoding) AS min_distance
        FROM portfolio.detected_face df
        CROSS JOIN ref_faces rf
        WHERE df.image_id IS NOT NULL
        GROUP BY df.image_id
        HAVING MIN(df.encoding <=> rf.encoding) < p_threshold
    ),

    -- ── Main pagination ────────────────────────────────────────────────────

    base_images AS (
        -- Combine image metadata with pre-computed sort metrics via LEFT JOINs
        -- (replacing the old correlated subqueries).
        SELECT
            i.id,
            i.created_at,
            CASE WHEN p_sort_person_id IS NOT NULL THEN
                CASE WHEN ti.image_id IS NOT NULL THEN 1 ELSE 0 END
            ELSE NULL END AS is_tagged,
            CASE WHEN p_sort_person_id IS NOT NULL THEN
                imd.min_distance
            ELSE NULL END AS min_distance
        FROM portfolio.image i
        LEFT JOIN tagged_image_ids ti ON ti.image_id = i.id
        LEFT JOIN image_min_distances imd ON imd.image_id = i.id
        WHERE i.source_url IS NOT NULL
          AND (
              p_search IS NULL
              OR i.source_url ILIKE '%' || p_search || '%'
              OR i.filename  ILIKE '%' || p_search || '%'
          )
          -- Apply default-sort cursor early (skipped when using person sort so the
          -- person-sort cursor can be applied after computing is_tagged/min_distance)
          AND (
              p_sort_person_id IS NOT NULL
              OR p_cursor_created_at IS NULL
              OR (i.created_at < p_cursor_created_at)
              OR (i.created_at = p_cursor_created_at AND i.id > p_cursor_id)
          )
    ),

    paginated AS (
        -- Apply the person-sort cursor (when relevant) and limit to p_limit + 1 rows.
        SELECT id, created_at, is_tagged, min_distance
        FROM base_images
        WHERE
            -- Default sort: cursor already applied in base_images; pass all rows through.
            p_sort_person_id IS NULL
            -- Person sort: no cursor yet (first page).
            OR p_cursor_id IS NULL
            -- Person sort: image sorts later by is_tagged (DESC).
            OR (is_tagged < p_cursor_is_tagged)
            -- Person sort: same is_tagged, compare min_distance (ASC NULLS LAST) then id.
            OR (
                is_tagged = p_cursor_is_tagged
                AND (
                    -- cursor has a distance and current distance is greater
                    (p_cursor_min_distance IS NOT NULL AND min_distance IS NOT NULL AND min_distance > p_cursor_min_distance)
                    -- cursor has a distance but current is NULL (NULL sorts last)
                    OR (p_cursor_min_distance IS NOT NULL AND min_distance IS NULL)
                    -- both NULL: tiebreak by id
                    OR (p_cursor_min_distance IS NULL AND min_distance IS NULL AND id > p_cursor_id)
                    -- same distance: tiebreak by id
                    OR (
                        min_distance IS NOT NULL
                        AND p_cursor_min_distance IS NOT NULL
                        AND min_distance = p_cursor_min_distance
                        AND id > p_cursor_id
                    )
                )
            )
        ORDER BY
            -- Person sort keys (NULL when not used, ignored by DB)
            CASE WHEN p_sort_person_id IS NOT NULL THEN is_tagged    END DESC NULLS LAST,
            CASE WHEN p_sort_person_id IS NOT NULL THEN min_distance END ASC  NULLS LAST,
            -- Default sort key (NULL when not used)
            CASE WHEN p_sort_person_id IS NULL     THEN created_at  END DESC  NULLS LAST,
            -- Always tiebreak by id ASC
            id ASC
        LIMIT p_limit + 1
    )

    -- ── Final output ───────────────────────────────────────────────────────
    -- Join face data and person matches for the small paginated set (~40 images).
    SELECT
        p.id           AS image_id,
        i.filename,
        i.source_url,
        i.width,
        i.height,
        p.created_at,
        p.is_tagged    AS sort_is_tagged,
        p.min_distance AS sort_min_distance,
        df.id          AS face_id,
        df.encoding    AS face_encoding,
        df.location_top,
        df.location_right,
        df.location_bottom,
        df.location_left,
        df.person_id   AS assigned_person_id,
        matches.person_id   AS matched_person_id,
        matches.person_name AS matched_person_name,
        matches.distance    AS match_distance
    FROM paginated p
    JOIN portfolio.image i ON i.id = p.id
    LEFT JOIN portfolio.detected_face df ON df.image_id = p.id
    LEFT JOIN LATERAL (
        SELECT
            pr.id   AS person_id,
            pr.name AS person_name,
            MIN(df.encoding <=> ref.encoding) AS distance
        FROM portfolio.detected_face ref
        JOIN portfolio.person pr ON pr.id = ref.person_id
        WHERE ref.person_id IS NOT NULL
          AND df.encoding <=> ref.encoding < p_threshold
        GROUP BY pr.id, pr.name
        ORDER BY distance
        LIMIT p_top_n
    ) matches ON true
    ORDER BY
        CASE WHEN p_sort_person_id IS NOT NULL THEN p.is_tagged    END DESC NULLS LAST,
        CASE WHEN p_sort_person_id IS NOT NULL THEN p.min_distance END ASC  NULLS LAST,
        CASE WHEN p_sort_person_id IS NULL     THEN p.created_at  END DESC  NULLS LAST,
        p.id ASC;
$$;
