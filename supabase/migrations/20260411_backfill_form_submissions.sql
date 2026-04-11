-- Backfill form_submissions from members with domisili set.
-- domisili is only populated by the dukungan form (/api/public/register),
-- making it a reliable signal for form-origin members.

INSERT INTO form_submissions
  (type, member_id, is_new_member, nama, angkatan, no_hp, email, domisili, harapan, referral_name, created_at)
SELECT
  'dukungan',
  m.id,
  true,
  m.nama,
  m.angkatan,
  m.no_hp,
  m.email,
  m.domisili,
  m.harapan,
  m.referral_name,
  m.created_at
FROM members m
WHERE m.domisili IS NOT NULL
  AND m.id NOT IN (
    SELECT member_id FROM form_submissions WHERE member_id IS NOT NULL
  );
