-- Performance indexes for sub-1s query targets
-- Run this via Supabase SQL editor

-- ============================================================
-- wa_group_members: member_id is queried by EVERY heavy API
-- (alumni, targets, monitor, wa-group/stats) but has NO index!
-- This is the single biggest bottleneck.
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_wa_group_members_member_id
  ON wa_group_members(member_id)
  WHERE member_id IS NOT NULL;

-- ============================================================
-- alumni: composite for ORDER BY angkatan, nama
-- Used by: /api/targets, /api/alumni, /api/alumni/search
-- Existing idx_alumni_angkatan only covers angkatan column.
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_alumni_angkatan_nama
  ON alumni(angkatan, nama);

-- ============================================================
-- members: composite for ORDER BY angkatan, nama
-- Used by: /api/assignments/monitor (full table scan + sort)
-- Existing idx_members_angkatan only covers angkatan column.
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_members_angkatan_nama
  ON members(angkatan, nama);

-- ============================================================
-- members: partial index on no_hp for phone matching
-- Used by: /api/wa-group/stats, /api/waha/sync, wa-group link
-- Skips empty strings which are common (uncontacted alumni).
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_members_no_hp
  ON members(no_hp)
  WHERE no_hp IS NOT NULL AND no_hp != '';

-- ============================================================
-- event_attendance: composite for the common IN + count pattern
-- Already has idx_attendance_member(member_id), but adding
-- a covering index with event_id avoids heap lookups.
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_event_attendance_member_event
  ON event_attendance(member_id, event_id);

-- ============================================================
-- members: partial index on referred_by for cascade delete
-- Used by: DELETE /api/members/[id] (update referred_by = null)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_members_referred_by
  ON members(referred_by)
  WHERE referred_by IS NOT NULL;
