-- Log every public form submission (dukungan + event)
CREATE TABLE IF NOT EXISTS form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('dukungan', 'event')),
  member_id UUID REFERENCES members(id) ON DELETE SET NULL,
  is_new_member BOOLEAN NOT NULL DEFAULT false,
  nama TEXT NOT NULL,
  angkatan INTEGER NOT NULL,
  no_hp TEXT,
  email TEXT,
  domisili TEXT,
  harapan TEXT,
  referral_name TEXT,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  event_name TEXT,
  will_attend BOOLEAN,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for querying recent submissions
CREATE INDEX idx_form_submissions_created_at ON form_submissions(created_at DESC);
CREATE INDEX idx_form_submissions_type ON form_submissions(type);

-- RLS: only service role can insert, authenticated users can read
ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read form submissions"
  ON form_submissions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can insert form submissions"
  ON form_submissions FOR INSERT
  TO service_role
  WITH CHECK (true);
