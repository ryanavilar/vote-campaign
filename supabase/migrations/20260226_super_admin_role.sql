-- ============================================
-- Add Super Admin Role
-- ============================================

-- 1. Update CHECK constraint to include super_admin
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;
ALTER TABLE user_roles ADD CONSTRAINT user_roles_role_check
  CHECK (role IN ('super_admin', 'admin', 'campaigner', 'viewer'));

-- 2. Update RLS policies on user_roles to include super_admin

DROP POLICY IF EXISTS "Admin can insert roles" ON user_roles;
CREATE POLICY "Admin can insert roles"
  ON user_roles FOR INSERT TO authenticated
  WITH CHECK (get_user_role() IN ('super_admin', 'admin'));

DROP POLICY IF EXISTS "Admin can update roles" ON user_roles;
CREATE POLICY "Admin can update roles"
  ON user_roles FOR UPDATE TO authenticated
  USING (get_user_role() IN ('super_admin', 'admin'))
  WITH CHECK (get_user_role() IN ('super_admin', 'admin'));

DROP POLICY IF EXISTS "Admin can delete roles" ON user_roles;
CREATE POLICY "Admin can delete roles"
  ON user_roles FOR DELETE TO authenticated
  USING (get_user_role() IN ('super_admin', 'admin'));

-- 3. Update RLS on events to include super_admin

DROP POLICY IF EXISTS "Admin and campaigner can create events" ON events;
CREATE POLICY "Admin and campaigner can create events"
  ON events FOR INSERT TO authenticated
  WITH CHECK (get_user_role() IN ('super_admin', 'admin', 'campaigner'));

DROP POLICY IF EXISTS "Admin and campaigner can update events" ON events;
CREATE POLICY "Admin and campaigner can update events"
  ON events FOR UPDATE TO authenticated
  USING (get_user_role() IN ('super_admin', 'admin', 'campaigner'))
  WITH CHECK (get_user_role() IN ('super_admin', 'admin', 'campaigner'));

DROP POLICY IF EXISTS "Only admin can delete events" ON events;
CREATE POLICY "Only admin can delete events"
  ON events FOR DELETE TO authenticated
  USING (get_user_role() IN ('super_admin', 'admin'));

-- 4. Update RLS on event_attendance to include super_admin

DROP POLICY IF EXISTS "Admin and campaigner can create attendance" ON event_attendance;
CREATE POLICY "Admin and campaigner can create attendance"
  ON event_attendance FOR INSERT TO authenticated
  WITH CHECK (get_user_role() IN ('super_admin', 'admin', 'campaigner'));

DROP POLICY IF EXISTS "Admin and campaigner can update attendance" ON event_attendance;
CREATE POLICY "Admin and campaigner can update attendance"
  ON event_attendance FOR UPDATE TO authenticated
  USING (get_user_role() IN ('super_admin', 'admin', 'campaigner'))
  WITH CHECK (get_user_role() IN ('super_admin', 'admin', 'campaigner'));

DROP POLICY IF EXISTS "Admin and campaigner can delete attendance" ON event_attendance;
CREATE POLICY "Admin and campaigner can delete attendance"
  ON event_attendance FOR DELETE TO authenticated
  USING (get_user_role() IN ('super_admin', 'admin', 'campaigner'));

-- 5. Update RLS on event_registrations to include super_admin

DROP POLICY IF EXISTS "admin_manage_registrations" ON event_registrations;
CREATE POLICY "admin_manage_registrations"
  ON event_registrations FOR ALL TO authenticated
  USING (get_user_role() IN ('super_admin', 'admin', 'campaigner'))
  WITH CHECK (get_user_role() IN ('super_admin', 'admin', 'campaigner'));

-- 6. Update app_settings write policy: only super_admin can manage settings

DROP POLICY IF EXISTS "Admin can manage settings" ON app_settings;
CREATE POLICY "Super admin can manage settings"
  ON app_settings FOR ALL TO authenticated
  USING (get_user_role() = 'super_admin')
  WITH CHECK (get_user_role() = 'super_admin');

-- Keep the read policy for all authenticated (WAHA config is read by sync API via service role)
-- "Authenticated can view settings" already exists and stays as-is
