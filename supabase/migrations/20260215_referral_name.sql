-- Add referral_name column to store the free-text referral entry from forms
ALTER TABLE members ADD COLUMN IF NOT EXISTS referral_name TEXT;
