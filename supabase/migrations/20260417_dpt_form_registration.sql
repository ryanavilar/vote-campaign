-- Add Isi Form DPT and Registrasi Website DPT tracking columns
ALTER TABLE members
  ADD COLUMN IF NOT EXISTS isi_form_dpt TEXT
  CHECK (isi_form_dpt IN ('Sudah', 'Belum') OR isi_form_dpt IS NULL);

ALTER TABLE members
  ADD COLUMN IF NOT EXISTS registrasi_website_dpt TEXT
  CHECK (registrasi_website_dpt IN ('Sudah', 'Belum') OR registrasi_website_dpt IS NULL);
