-- Add alternate phone numbers array to members
ALTER TABLE members ADD COLUMN IF NOT EXISTS alt_phones TEXT[] DEFAULT '{}';
