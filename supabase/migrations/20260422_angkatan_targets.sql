-- Per-angkatan dukung targets (editable via admin UI / Studio)
CREATE TABLE IF NOT EXISTS angkatan_targets (
  angkatan INTEGER PRIMARY KEY,
  target_dukung INTEGER,
  label TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Allow all authenticated users to read; only admins to write (enforced in API).
ALTER TABLE angkatan_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "angkatan_targets read for authenticated"
  ON angkatan_targets FOR SELECT
  TO authenticated
  USING (true);

-- Writes go through API with service role.
