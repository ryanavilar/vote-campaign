-- Enable trigram extension for fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Alumni master table (base data from SMA Taruna Nusantara)
CREATE TABLE IF NOT EXISTS alumni (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nosis TEXT,
  nama TEXT NOT NULL,
  angkatan INTEGER NOT NULL CHECK (angkatan >= 1 AND angkatan <= 33),
  kelanjutan_studi TEXT,
  program_studi TEXT,
  keterangan TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint for upsert matching (case-insensitive, trimmed)
CREATE UNIQUE INDEX idx_alumni_nama_angkatan ON alumni(LOWER(TRIM(nama)), angkatan);

-- Fast filtering by batch
CREATE INDEX idx_alumni_angkatan ON alumni(angkatan);

-- Fast fuzzy name search via trigram
CREATE INDEX idx_alumni_nama_trgm ON alumni USING gin (nama gin_trgm_ops);

-- RLS
ALTER TABLE alumni ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view alumni"
  ON alumni FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can manage alumni"
  ON alumni FOR ALL TO authenticated
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

CREATE POLICY "Service role full access on alumni"
  ON alumni FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Reuse existing trigger function for updated_at
DROP TRIGGER IF EXISTS set_updated_at_alumni ON alumni;
CREATE TRIGGER set_updated_at_alumni
  BEFORE UPDATE ON alumni
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Link members to alumni (member → alumni FK)
ALTER TABLE members ADD COLUMN IF NOT EXISTS alumni_id UUID REFERENCES alumni(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_members_alumni_id ON members(alumni_id);
