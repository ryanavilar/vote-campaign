-- ============================================
-- Campaigner Role Rename + Assignment + WAHA Settings
-- ============================================

-- 1. Rename koordinator → campaigner in existing data
UPDATE user_roles SET role = 'campaigner' WHERE role = 'koordinator';

-- 2. Update CHECK constraint on user_roles
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;
ALTER TABLE user_roles ADD CONSTRAINT user_roles_role_check
  CHECK (role IN ('admin', 'campaigner', 'viewer'));

-- 3. Recreate RLS policies that reference 'koordinator'

-- Events table
DROP POLICY IF EXISTS "Admin and koordinator can create events" ON events;
CREATE POLICY "Admin and campaigner can create events"
  ON events FOR INSERT TO authenticated
  WITH CHECK (get_user_role() IN ('admin', 'campaigner'));

DROP POLICY IF EXISTS "Admin and koordinator can update events" ON events;
CREATE POLICY "Admin and campaigner can update events"
  ON events FOR UPDATE TO authenticated
  USING (get_user_role() IN ('admin', 'campaigner'))
  WITH CHECK (get_user_role() IN ('admin', 'campaigner'));

-- Event attendance table
DROP POLICY IF EXISTS "Admin and koordinator can create attendance" ON event_attendance;
CREATE POLICY "Admin and campaigner can create attendance"
  ON event_attendance FOR INSERT TO authenticated
  WITH CHECK (get_user_role() IN ('admin', 'campaigner'));

DROP POLICY IF EXISTS "Admin and koordinator can update attendance" ON event_attendance;
CREATE POLICY "Admin and campaigner can update attendance"
  ON event_attendance FOR UPDATE TO authenticated
  USING (get_user_role() IN ('admin', 'campaigner'))
  WITH CHECK (get_user_role() IN ('admin', 'campaigner'));

DROP POLICY IF EXISTS "Admin and koordinator can delete attendance" ON event_attendance;
CREATE POLICY "Admin and campaigner can delete attendance"
  ON event_attendance FOR DELETE TO authenticated
  USING (get_user_role() IN ('admin', 'campaigner'));

-- Event registrations table
DROP POLICY IF EXISTS "admin_manage_registrations" ON event_registrations;
CREATE POLICY "admin_manage_registrations" ON event_registrations FOR ALL TO authenticated
  USING (get_user_role() IN ('admin','campaigner'))
  WITH CHECK (get_user_role() IN ('admin','campaigner'));

-- 4. Add assigned_to column for campaigner assignment
ALTER TABLE members ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_members_assigned_to ON members(assigned_to);

-- 5. Create app_settings table for WAHA config
CREATE TABLE IF NOT EXISTS app_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view settings"
  ON app_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can manage settings"
  ON app_settings FOR ALL TO authenticated
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

CREATE POLICY "Service role full access on settings"
  ON app_settings FOR ALL TO service_role
  USING (true) WITH CHECK (true);
