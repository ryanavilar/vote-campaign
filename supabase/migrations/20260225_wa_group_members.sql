-- Create wa_group_members table for tracking WhatsApp group participants
CREATE TABLE IF NOT EXISTS wa_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  wa_name TEXT,
  member_id UUID REFERENCES members(id) ON DELETE SET NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS wa_group_members_phone_idx ON wa_group_members(phone);

ALTER TABLE wa_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY wa_group_members_auth_all ON wa_group_members
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
