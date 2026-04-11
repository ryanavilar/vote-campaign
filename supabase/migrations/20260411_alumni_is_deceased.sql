-- Add is_deceased boolean flag to alumni table
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS is_deceased BOOLEAN NOT NULL DEFAULT false;

-- Backfill from existing keterangan data
UPDATE alumni SET is_deceased = true
WHERE lower(keterangan) LIKE '%almarhum%'
   OR lower(keterangan) LIKE '%meninggal%'
   OR lower(keterangan) LIKE '%wafat%';
