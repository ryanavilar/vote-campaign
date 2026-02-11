-- ============================================
-- Campaign Monitoring Platform - Migration
-- Adds: user_roles, events, event_attendance
-- Modifies: members (add referred_by)
-- ============================================

-- ============================================
-- 1. USER ROLES TABLE (RBAC)
-- ============================================
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'koordinator', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Helper function to get current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT COALESCE(
    (SELECT role FROM user_roles WHERE user_id = auth.uid()),
    'viewer'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- RLS for user_roles
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view roles"
  ON user_roles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin can insert roles"
  ON user_roles FOR INSERT
  TO authenticated
  WITH CHECK (get_user_role() = 'admin');

CREATE POLICY "Admin can update roles"
  ON user_roles FOR UPDATE
  TO authenticated
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

CREATE POLICY "Admin can delete roles"
  ON user_roles FOR DELETE
  TO authenticated
  USING (get_user_role() = 'admin');

CREATE POLICY "Service role full access on user_roles"
  ON user_roles FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 2. EVENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nama TEXT NOT NULL,
  jenis TEXT NOT NULL CHECK (jenis IN ('Silaturahmi', 'Rapat', 'Door-to-door', 'Rally', 'Sosialisasi', 'Lainnya')),
  deskripsi TEXT,
  lokasi TEXT,
  tanggal TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'Terjadwal' CHECK (status IN ('Terjadwal', 'Berlangsung', 'Selesai', 'Dibatalkan')),
  checkin_code TEXT UNIQUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_tanggal ON events(tanggal);
CREATE INDEX IF NOT EXISTS idx_events_checkin_code ON events(checkin_code);

-- Updated_at trigger (reuse existing function)
DROP TRIGGER IF EXISTS set_updated_at_events ON events;
CREATE TRIGGER set_updated_at_events
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS for events
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view events"
  ON events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin and koordinator can create events"
  ON events FOR INSERT
  TO authenticated
  WITH CHECK (get_user_role() IN ('admin', 'koordinator'));

CREATE POLICY "Admin and koordinator can update events"
  ON events FOR UPDATE
  TO authenticated
  USING (get_user_role() IN ('admin', 'koordinator'))
  WITH CHECK (get_user_role() IN ('admin', 'koordinator'));

CREATE POLICY "Only admin can delete events"
  ON events FOR DELETE
  TO authenticated
  USING (get_user_role() = 'admin');

CREATE POLICY "Service role full access on events"
  ON events FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 3. EVENT ATTENDANCE TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS event_attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  checked_in_at TIMESTAMPTZ DEFAULT NOW(),
  checked_in_by UUID REFERENCES auth.users(id),
  catatan TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, member_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_attendance_event ON event_attendance(event_id);
CREATE INDEX IF NOT EXISTS idx_attendance_member ON event_attendance(member_id);

-- RLS for event_attendance
ALTER TABLE event_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view attendance"
  ON event_attendance FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin and koordinator can create attendance"
  ON event_attendance FOR INSERT
  TO authenticated
  WITH CHECK (get_user_role() IN ('admin', 'koordinator'));

CREATE POLICY "Admin and koordinator can update attendance"
  ON event_attendance FOR UPDATE
  TO authenticated
  USING (get_user_role() IN ('admin', 'koordinator'))
  WITH CHECK (get_user_role() IN ('admin', 'koordinator'));

CREATE POLICY "Admin and koordinator can delete attendance"
  ON event_attendance FOR DELETE
  TO authenticated
  USING (get_user_role() IN ('admin', 'koordinator'));

CREATE POLICY "Service role full access on event_attendance"
  ON event_attendance FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 4. ADD referred_by TO MEMBERS
-- ============================================
ALTER TABLE members ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES members(id);

-- ============================================
-- 5. ASSIGN EXISTING ADMIN USER THE ADMIN ROLE
-- ============================================
-- This will be done via the seed endpoint or manually
