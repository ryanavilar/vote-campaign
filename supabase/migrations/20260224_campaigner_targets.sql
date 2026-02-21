-- ============================================
-- Campaigner Targets Junction Table
-- Supports many-to-many: 1 member can have multiple campaigners
-- ============================================

-- Create junction table
CREATE TABLE IF NOT EXISTS campaigner_targets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, member_id)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_ct_user ON campaigner_targets(user_id);
CREATE INDEX IF NOT EXISTS idx_ct_member ON campaigner_targets(member_id);

-- Enable RLS
ALTER TABLE campaigner_targets ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view targets"
  ON campaigner_targets FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert targets"
  ON campaigner_targets FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete targets"
  ON campaigner_targets FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Service role full access on targets"
  ON campaigner_targets FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Migrate existing assigned_to data into junction table
INSERT INTO campaigner_targets (user_id, member_id)
SELECT assigned_to, id FROM members WHERE assigned_to IS NOT NULL
ON CONFLICT (user_id, member_id) DO NOTHING;
