-- ============================================
-- Auto-Link Alumni: is_non_alumni + pending matches + fuzzy RPC
-- ============================================

-- 1. Add is_non_alumni flag to members
ALTER TABLE members ADD COLUMN IF NOT EXISTS is_non_alumni BOOLEAN DEFAULT FALSE;

-- Create index for filtering non-alumni
CREATE INDEX IF NOT EXISTS idx_members_is_non_alumni
  ON members(is_non_alumni) WHERE is_non_alumni = TRUE;

-- 2. Create pending alumni matches table
CREATE TABLE IF NOT EXISTS pending_alumni_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  alumni_id UUID NOT NULL REFERENCES alumni(id) ON DELETE CASCADE,
  similarity FLOAT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'linked', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Only one pending match per member at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_alumni_matches_member
  ON pending_alumni_matches(member_id) WHERE status = 'pending';

-- Fast lookup of pending items
CREATE INDEX IF NOT EXISTS idx_pending_alumni_matches_status
  ON pending_alumni_matches(status) WHERE status = 'pending';

-- 3. RLS policies
ALTER TABLE pending_alumni_matches ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view pending matches
CREATE POLICY "Authenticated users can view pending_alumni_matches"
  ON pending_alumni_matches FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated can insert (public register endpoint creates matches via service role)
CREATE POLICY "Service role can insert pending_alumni_matches"
  ON pending_alumni_matches FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Only admin/super_admin can update (resolve matches)
CREATE POLICY "Admin can update pending_alumni_matches"
  ON pending_alumni_matches FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'super_admin')
    )
  );

-- Service role full access
CREATE POLICY "Service role full access on pending_alumni_matches"
  ON pending_alumni_matches FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- 4. RPC function for fuzzy alumni matching
CREATE OR REPLACE FUNCTION match_alumni_fuzzy(
  p_nama TEXT,
  p_angkatan INTEGER,
  p_threshold FLOAT DEFAULT 0.6
)
RETURNS TABLE(id UUID, nama TEXT, angkatan INTEGER, sim FLOAT) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.nama,
    a.angkatan,
    similarity(LOWER(TRIM(a.nama)), LOWER(TRIM(p_nama)))::FLOAT AS sim
  FROM alumni a
  WHERE a.angkatan = p_angkatan
    AND similarity(LOWER(TRIM(a.nama)), LOWER(TRIM(p_nama))) >= p_threshold
  ORDER BY sim DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;
