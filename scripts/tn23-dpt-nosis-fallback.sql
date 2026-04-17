-- Link the 22 unresolved form submissions to TN 23 alumni by NOSIS match.
-- Updates member no_hp + isi_form_dpt='Sudah'; preserves alumni.nama unchanged.
BEGIN;

CREATE TEMP TABLE staging_nosis (
  form_nama TEXT NOT NULL,
  form_nosis TEXT NOT NULL,
  form_wa TEXT NOT NULL DEFAULT ''
) ON COMMIT DROP;

INSERT INTO staging_nosis (form_nama, form_nosis, form_wa) VALUES
  ('Adrian Ekoyudho Nugroho', '126511', '085878390533'),
  ('Muhamad Faiq Purnomo Putra', '126691', '082114009415'),
  ('Amira Latinsa Dina', '126514', '081249944091'),
  ('Derie septian santoso', '126552', '087789091828'),
  ('Ziko bintang yanottama', '126764', '081338882019'),
  ('Mochamad Fahmi Try Hindami, SH', '126687', '081219621446'),
  ('Laras sita', '126626', '081286035433'),
  ('Mochamad Rizky Fadhillah', '126655', '081324367176'),
  ('Mohammad Hari Adhitya Maulana', '126630', '085730510900'),
  ('Mohamad Abel', '126467', '087777366431'),
  ('Taruna Senjoyo Mardoko', '126601', '087872466401'),
  ('Purca Rio Willy Yoseph', '126498', '081235207308'),
  ('Fransiskus Xaverius Aditya Prabowo', '126426', '081311143529'),
  ('Muhammad Arif Wicaksono', '126431', '081262512019'),
  ('Muhamad Rifqi Fauzan', '126494', '085813787212'),
  ('Anisa Febrian Hidayati', '126545', '081288526180'),
  ('Orlando Kasyfillah Satya Nugraha', '126533', '081210689259'),
  ('Radiyya Dwisaputra', '126662', '087736080032'),
  ('Fachriza Muhammad Hilman', '126644', '0811910387'),
  ('Bagus Ramasha Amangku', '126480', '082123117011'),
  ('Nimas Rosyana P', '126532', '08119452882'),
  ('Radytya Bagus Bimoaji', '126635', '081336696876');

-- Resolve each staged row to its alumni via NOSIS (we verified 22/22 NOSIS match).
-- Use the ALUMNI'S canonical nama for members (avoids divergence with alumni).
WITH resolved AS (
  SELECT a.id AS alumni_id, a.nama AS alumni_nama, NULLIF(s.form_wa, '') AS wa
  FROM alumni a
  JOIN staging_nosis s ON a.nosis = s.form_nosis AND a.angkatan = 23
),
-- Update existing members matched by alumni_id or by alumni's normalized name
updated AS (
  UPDATE members m
  SET
    no_hp = COALESCE(r.wa, m.no_hp),
    alumni_id = r.alumni_id,
    isi_form_dpt = 'Sudah'
  FROM resolved r
  WHERE m.angkatan = 23
    AND (
      m.alumni_id = r.alumni_id
      OR (m.alumni_id IS NULL AND LOWER(TRIM(m.nama)) = LOWER(TRIM(r.alumni_nama)))
    )
  RETURNING m.id, r.alumni_id
),
-- Identify rows that need a new member (no existing match found above)
missing AS (
  SELECT r.*
  FROM resolved r
  WHERE r.alumni_id NOT IN (SELECT alumni_id FROM updated)
),
numbered AS (
  SELECT
    (SELECT COALESCE(MAX(no), 0) FROM members) + ROW_NUMBER() OVER (ORDER BY alumni_nama) AS no,
    alumni_nama, wa, alumni_id
  FROM missing
)
INSERT INTO members (no, nama, angkatan, no_hp, alumni_id, isi_form_dpt)
SELECT no, alumni_nama, 23, COALESCE(wa, ''), alumni_id, 'Sudah'
FROM numbered;

COMMIT;

SELECT
  (SELECT COUNT(*) FROM members WHERE angkatan = 23) AS members_tn23,
  (SELECT COUNT(*) FROM members WHERE angkatan = 23 AND isi_form_dpt = 'Sudah') AS form_dpt_sudah,
  (SELECT COUNT(*) FROM members WHERE angkatan = 23 AND no_hp IS NOT NULL AND no_hp <> '') AS with_phone;
