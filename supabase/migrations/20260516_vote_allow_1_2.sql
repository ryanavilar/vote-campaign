-- Allow vote values "1" (pilih kita) and "2" (pilih sebelah) in addition to
-- legacy "Sudah"/"Belum"/null. Backward-compat: existing rows with "Sudah"
-- treated as "voted (unspecified choice)" until manually updated.

ALTER TABLE members DROP CONSTRAINT IF EXISTS members_vote_check;
ALTER TABLE members
  ADD CONSTRAINT members_vote_check
  CHECK (vote IN ('Sudah', 'Belum', '1', '2') OR vote IS NULL);
