-- Fuzzy member matching RPC (same pattern as match_alumni_fuzzy)
-- Used by the public register route to find existing members
-- when the submitted name doesn't exactly match.
CREATE OR REPLACE FUNCTION match_member_fuzzy(
  p_nama TEXT,
  p_angkatan INTEGER,
  p_threshold FLOAT DEFAULT 0.5
)
RETURNS TABLE(id UUID, nama TEXT, angkatan INTEGER, sim FLOAT) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.nama,
    m.angkatan,
    similarity(LOWER(TRIM(m.nama)), LOWER(TRIM(p_nama)))::FLOAT AS sim
  FROM members m
  WHERE m.angkatan = p_angkatan
    AND m.is_non_alumni IS NOT TRUE
    AND similarity(LOWER(TRIM(m.nama)), LOWER(TRIM(p_nama))) >= p_threshold
  ORDER BY sim DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;
