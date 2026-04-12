-- Backfill members from past form/dukungan submissions:
-- mark them as contacted, set their phone, and record their support status.
WITH latest AS (
  SELECT DISTINCT ON (member_id)
    member_id,
    no_hp,
    created_at
  FROM form_submissions
  WHERE type = 'dukungan'
    AND member_id IS NOT NULL
  ORDER BY member_id, created_at DESC
)
UPDATE members m
SET
  sudah_dikontak = 'Sudah',
  dukungan = 'dukung',
  no_hp = COALESCE(NULLIF(latest.no_hp, ''), m.no_hp)
FROM latest
WHERE m.id = latest.member_id;
