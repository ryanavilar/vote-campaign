-- Expand angkatan constraint from 33 to 35 (to support KELAS XII=33, XI=34, X=35)
ALTER TABLE alumni DROP CONSTRAINT IF EXISTS alumni_angkatan_check;
ALTER TABLE alumni ADD CONSTRAINT alumni_angkatan_check CHECK (angkatan >= 1 AND angkatan <= 35);
