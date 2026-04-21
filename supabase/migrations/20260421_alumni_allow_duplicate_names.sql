-- Alumni can legitimately share the same name within the same angkatan.
-- The Master_Data_NOSIS.xlsx source confirms cases where two distinct NOSIS
-- map to the same person-name (e.g. TN2 "Arief Setyawan" at 910319 & 910357).
-- Replace the UNIQUE index with a non-unique index so lookups stay fast
-- without rejecting real duplicates.

DROP INDEX IF EXISTS idx_alumni_nama_angkatan;

CREATE INDEX IF NOT EXISTS idx_alumni_nama_angkatan
  ON alumni (LOWER(TRIM(nama)), angkatan);
