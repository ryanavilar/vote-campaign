-- Event registrations (RSVP) — separate from actual attendance/check-in
CREATE TABLE IF NOT EXISTS event_registrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  will_attend BOOLEAN NOT NULL DEFAULT true,
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_reg_event ON event_registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_reg_will_attend ON event_registrations(event_id, will_attend);

ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_select_registrations" ON event_registrations FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_role_registrations" ON event_registrations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admin_manage_registrations" ON event_registrations FOR ALL TO authenticated
  USING (get_user_role() IN ('admin','koordinator'))
  WITH CHECK (get_user_role() IN ('admin','koordinator'));
