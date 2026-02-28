-- Canvassing tracking: angkatan-based assignment + dukungan field

-- 1. Create campaigner_angkatan junction table
CREATE TABLE IF NOT EXISTS campaigner_angkatan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  angkatan INTEGER NOT NULL CHECK (angkatan >= 1 AND angkatan <= 35),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, angkatan)
);

-- 2. Add dukungan column to members
ALTER TABLE members ADD COLUMN IF NOT EXISTS dukungan TEXT;

-- 3. RLS for campaigner_angkatan
ALTER TABLE campaigner_angkatan ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read angkatan assignments
DROP POLICY IF EXISTS "Users can view angkatan assignments" ON campaigner_angkatan;
CREATE POLICY "Users can view angkatan assignments"
  ON campaigner_angkatan FOR SELECT
  TO authenticated
  USING (true);

-- Allow admins and super_admins to manage angkatan assignments
DROP POLICY IF EXISTS "Admins can manage angkatan assignments" ON campaigner_angkatan;
CREATE POLICY "Admins can manage angkatan assignments"
  ON campaigner_angkatan FOR ALL
  TO authenticated
  USING (get_user_role() IN ('admin', 'super_admin'))
  WITH CHECK (get_user_role() IN ('admin', 'super_admin'));
