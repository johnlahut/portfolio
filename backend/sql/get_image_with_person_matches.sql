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

-- RPC function to get all images with detected faces and their top N closest person matches
-- Matches are found by comparing face encodings against other detected faces that have been assigned to a person
CREATE OR REPLACE FUNCTION portfolio.get_all_images_with_person_matches(
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
    ORDER BY i.id;
$$;
