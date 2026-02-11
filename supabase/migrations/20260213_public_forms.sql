-- Add new columns for public registration form
ALTER TABLE members ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS domisili TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS harapan TEXT;
