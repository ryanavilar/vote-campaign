-- ============================================
-- Database Pemenangan Ikastara Kita
-- Run this SQL in Supabase SQL Editor
-- ============================================

-- Create the members table
CREATE TABLE IF NOT EXISTS members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  no INTEGER UNIQUE NOT NULL,
  nama TEXT NOT NULL,
  angkatan INTEGER NOT NULL,
  no_hp TEXT,
  pic TEXT,
  status_dpt TEXT CHECK (status_dpt IN ('Sudah', 'Belum') OR status_dpt IS NULL),
  sudah_dikontak TEXT CHECK (sudah_dikontak IN ('Sudah', 'Belum') OR sudah_dikontak IS NULL),
  masuk_grup TEXT CHECK (masuk_grup IN ('Sudah', 'Belum') OR masuk_grup IS NULL),
  vote TEXT CHECK (vote IN ('Sudah', 'Belum') OR vote IS NULL),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create an index on angkatan for filtering
CREATE INDEX IF NOT EXISTS idx_members_angkatan ON members(angkatan);

-- Enable Row Level Security
ALTER TABLE members ENABLE ROW LEVEL SECURITY;

-- Policy: authenticated users can read all members
CREATE POLICY "Authenticated users can view members"
  ON members FOR SELECT
  TO authenticated
  USING (true);

-- Policy: authenticated users can update members
CREATE POLICY "Authenticated users can update members"
  ON members FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy: authenticated users can insert members
CREATE POLICY "Authenticated users can insert members"
  ON members FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: service role can do everything (for seeding)
CREATE POLICY "Service role full access"
  ON members FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at
DROP TRIGGER IF EXISTS set_updated_at ON members;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
