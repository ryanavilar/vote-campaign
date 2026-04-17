-- TN 23 DPT Verification — upsert alumni & members from validated form submissions
-- Source: Formulir Verifikasi Data DPT (Munas XI IKASTARA 2026), filtered to Validate = 'Valid'
-- Generated: 2026-04-17
--
-- Matching strategy: normalized name (LOWER(TRIM(nama))) is the primary key because
-- it's the DB's unique index. NOSIS is secondary because form submitters sometimes
-- mistype it. We never rewrite alumni.nama based on NOSIS match alone — that would
-- clobber another alumni's record.

BEGIN;

CREATE TEMP TABLE staging_tn23 (
  nama TEXT NOT NULL,
  nosis TEXT NOT NULL,
  wa TEXT NOT NULL DEFAULT ''
) ON COMMIT DROP;

INSERT INTO staging_tn23 (nama, nosis, wa) VALUES
  ('Rizka Hartati', '126538', '08111058880'),
  ('Fajar Muhammad Al Farouk', '126582', '085230513097'),
  ('Habib Laksmana Prima', '126461', '081228521545'),
  ('Andro Rizaldy', '126611', '087809076984'),
  ('Adrian Ekoyudho Nugroho', '126511', '085878390533'),
  ('FARAH NOVELIA AYU PUTRI', '126457', '081385533310'),
  ('Muhamad Faiq Purnomo Putra', '126691', '082114009415'),
  ('RAHMAT BAGUS PRASETYA', '126438', '081217332841'),
  ('Amira Latinsa Dina', '126514', '081249944091'),
  ('Amelia Paramitha Mahanani', '126478', '+6288216062961'),
  ('Derie septian santoso', '126552', '087789091828'),
  ('Bimo Hardianto', '126421', '081235424761'),
  ('Chairul Surya Ruhananto', '126482', '081393554334'),
  ('Rafdi Maulana Muzaki', '126725', '083899449918'),
  ('Faiz Firdaus Shalahuddin', '126744', '085811815145'),
  ('Ghina Rahmania Fikri', '126524', '082322328811'),
  ('Azalea Dewi Aisyah', '126707', '081226516363'),
  ('Hafid Satrio Priambodo', '126681', '081210740522'),
  ('Neo Aditya Kuntar', '126471', '085253952351'),
  ('Bayu Abdi Pamungkas', '126579', '081296479955'),
  ('Andhika Bimo Prasojo', '126641', '087775572123'),
  ('Raditya Andy Darmawan Surya', '126437', '085156351527'),
  ('GALIH MARIZHA', '126680', '081273938537'),
  ('Haries Rachman', '126621', '081215456101'),
  ('Farrasila Nadhira', '126583', '085692977978'),
  ('Kadek maydhania vidari dewi', '126465', '+61 474 507 748'),
  ('Gleneagles Putri', '126585', '081314660025'),
  ('septian dwi cahya', '126600', '081332193219'),
  ('Aryo Dwi Wicaksono', '126705', '082243531001'),
  ('Ziko bintang yanottama', '126764', '081338882019'),
  ('Sandy Tresna Wahyudi Putri', '126636', '085326134603'),
  ('Rudini Baharrudin Syah', '126760', '081318451997'),
  ('Andhika Rizky Pratama', '126610', '081286134476'),
  ('REDIA MUHAMMAD HUSAIN', '126543', '081363252019'),
  ('Harashta Wendranirsa', '126682', '081282209784'),
  ('Mochamad Fahmi Try Hindami, SH', '126687', '081219621446'),
  ('Yudha Prawira', '126763', '082225509860'),
  ('Made Billy Christ Lukito Sudina', '126529', '081353244282'),
  ('Gede Fajar Satria', '126647', '081999515745'),
  ('Laras sita', '126626', '081286035433'),
  ('Mochamad Rizky Fadhillah', '126655', '081324367176'),
  ('Dani Hayqal', '126614', '081919972020'),
  ('Mohammad Hari Adhitya Maulana', '126630', '085730510900'),
  ('Rio Ahmanik Saputra', '126440', '081249718826'),
  ('Mohamad Abel', '126467', '087777366431'),
  ('Evan Chandra Darussalam', '126521', '085384841505'),
  ('Taruna Senjoyo Mardoko', '126601', '087872466401'),
  ('Lintang Putra Sadewa', '126561', '082134336548'),
  ('Purca Rio Willy Yoseph', '126498', '081235207308'),
  ('Bagus Himawan Wicaksono', '126548', '081809988997'),
  ('Fransiskus Xaverius Aditya Prabowo', '126426', '081311143529'),
  ('Muhammad Arif Wicaksono', '126431', '081262512019'),
  ('Muhamad Rifqi Fauzan', '126494', '085813787212'),
  ('Anisa Febrian Hidayati', '126545', '081288526180'),
  ('Aji Rahman Prabowo', '126606', '081312371132'),
  ('Alif Firman Tawakal', '126513', '082221033900'),
  ('Anggita Rahmawati Putri', '126673', '08112315097'),
  ('Try Luthfi Nugroho', '126505', '081196991096'),
  ('Annisa Ardi Ayuningtyas', '126447', '081391658948'),
  ('Fatma Harmadani', '126554', '0811770111'),
  ('Jonathan togatorop', '126653', '081289882306'),
  ('Orlando Kasyfillah Satya Nugraha', '126533', '081210689259'),
  ('Hanif Junisaf Ahmad', '126462', '082210537030'),
  ('Adhika Maulana Jati Utomo', '126701', '081329506429'),
  ('Rahmad Febianto', '126695', '082169544445'),
  ('Mutia Rahmania', '126496', '085157400197'),
  ('BAGUS AGAM PRATAMAJATI', '126518', '085647535377'),
  ('R. PANJI RIZQI SATRIOTOMO', '126436', '087725863707'),
  ('Maulidya Sari Daulay', '126686', '082136659916'),
  ('Rizky Pratama Hendra', '126665', '081282848860'),
  ('Bagas Panandito', '126708', '082288061575'),
  ('Riqa Dara Setya Pranda', '126729', '082210022889'),
  ('Nadila Nurfairuz Amalina', '126692', '081398689714'),
  ('Ardi Gelar Laksana', '126449', '082226927910'),
  ('Febrian Yudha Swara', '126488', '081222333750'),
  ('Muhammad Fikri Hafiya', '126596', '081223882281'),
  ('Radiyya Dwisaputra', '126662', '087736080032'),
  ('Faradita Maudy Sari', '126423', '085649160234'),
  ('Muhammad ihza Nurrabbani', '126657', '081226530804'),
  ('Immaculata Titis Winiati', '126526', '+447470619603'),
  ('Amira Nazihah Syarif', '126609', '085868874456'),
  ('HARRY FERNANDO', '126648', '089638068082'),
  ('Fachriza Muhammad Hilman', '126644', '0811910387'),
  ('NOGATI CHAIRUNNISA', '126660', '+6285741410563'),
  ('Karimaldri Narasatya', '126749', '0816934744'),
  ('Akbar Rahmatullah Adhiputra', '126735', '085231454905'),
  ('Klaudius Liasta', '126625', '087787588318'),
  ('Bagus Ramasha Amangku', '126480', '082123117011'),
  ('Bella Evania Adriani Waromij', '126674', '081240494984'),
  ('Nabilla Dyah Eka Pramudhita', '126566', '082112565926'),
  ('Regita Alya Savira', '125726', '08113966789'),
  ('Abyan Muzaky', '126477', '081326695122'),
  ('Nimas Rosyana P', '126532', '08119452882'),
  ('Hafidzah Nurul Ummah', '126428', '081290568718'),
  ('Radytya Bagus Bimoaji', '126635', '081336696876');

-- ---------------------------------------------------------------------------
-- Alumni upsert
-- ---------------------------------------------------------------------------

-- 1a. Update nama (casing/whitespace fix) when NOSIS matches AND normalized names already align.
UPDATE alumni a
SET nama = s.nama
FROM staging_tn23 s
WHERE a.angkatan = 23
  AND a.nosis = s.nosis
  AND LOWER(TRIM(a.nama)) = LOWER(TRIM(s.nama))
  AND a.nama <> s.nama;

-- 1b. Fill NOSIS for alumni matched by normalized name with missing NOSIS, only if the
--     staged NOSIS isn't already claimed by someone else in angkatan 23.
UPDATE alumni a
SET nosis = s.nosis
FROM staging_tn23 s
WHERE a.angkatan = 23
  AND (a.nosis IS NULL OR a.nosis = '')
  AND LOWER(TRIM(a.nama)) = LOWER(TRIM(s.nama))
  AND NOT EXISTS (
    SELECT 1 FROM alumni b WHERE b.angkatan = 23 AND b.nosis = s.nosis
  );

-- 1c. Insert alumni ONLY when neither normalized name NOR NOSIS matches an existing
--     angkatan-23 record. If NOSIS matches someone else (name mismatch), skip —
--     it's likely a form typo; the member step will still resolve by name.
INSERT INTO alumni (nosis, nama, angkatan)
SELECT s.nosis, s.nama, 23
FROM staging_tn23 s
WHERE NOT EXISTS (
  SELECT 1 FROM alumni a
  WHERE a.angkatan = 23
    AND (LOWER(TRIM(a.nama)) = LOWER(TRIM(s.nama)) OR a.nosis = s.nosis)
);

-- ---------------------------------------------------------------------------
-- Members: resolve each staged row to an alumni by normalized name, then upsert
-- contact data (no_hp, alumni_id, nama casing) and mark isi_form_dpt='Sudah'
-- to record that this person has filled out + validated the DPT verification
-- form. status_dpt (actual DPT completion) is managed separately.
-- ---------------------------------------------------------------------------

-- 2a. Update existing members (matched by alumni_id or by normalized name).
WITH resolved AS (
  SELECT a.id AS alumni_id, s.nama, NULLIF(s.wa, '') AS wa
  FROM alumni a
  JOIN staging_tn23 s
    ON a.angkatan = 23
   AND LOWER(TRIM(a.nama)) = LOWER(TRIM(s.nama))
)
UPDATE members m
SET
  no_hp = COALESCE(r.wa, m.no_hp),
  alumni_id = r.alumni_id,
  nama = r.nama,
  isi_form_dpt = 'Sudah'
FROM resolved r
WHERE m.angkatan = 23
  AND (
    m.alumni_id = r.alumni_id
    OR (m.alumni_id IS NULL AND LOWER(TRIM(m.nama)) = LOWER(TRIM(r.nama)))
  );

-- 2b. Insert members for staged records that don't yet have a member row.
WITH resolved AS (
  SELECT a.id AS alumni_id, s.nama, NULLIF(s.wa, '') AS wa
  FROM alumni a
  JOIN staging_tn23 s
    ON a.angkatan = 23
   AND LOWER(TRIM(a.nama)) = LOWER(TRIM(s.nama))
),
missing AS (
  SELECT r.*
  FROM resolved r
  WHERE NOT EXISTS (
    SELECT 1 FROM members m
    WHERE m.angkatan = 23
      AND (
        m.alumni_id = r.alumni_id
        OR (m.alumni_id IS NULL AND LOWER(TRIM(m.nama)) = LOWER(TRIM(r.nama)))
      )
  )
),
numbered AS (
  SELECT
    (SELECT COALESCE(MAX(no), 0) FROM members) + ROW_NUMBER() OVER (ORDER BY nama) AS no,
    nama, wa, alumni_id
  FROM missing
)
INSERT INTO members (no, nama, angkatan, no_hp, alumni_id, isi_form_dpt)
SELECT no, nama, 23, COALESCE(wa, ''), alumni_id, 'Sudah'
FROM numbered;

COMMIT;

-- Sanity check
SELECT
  (SELECT COUNT(*) FROM alumni WHERE angkatan = 23) AS alumni_tn23,
  (SELECT COUNT(*) FROM members WHERE angkatan = 23) AS members_tn23,
  (SELECT COUNT(*) FROM members WHERE angkatan = 23 AND isi_form_dpt = 'Sudah') AS form_dpt_sudah,
  (SELECT COUNT(*) FROM members WHERE angkatan = 23 AND no_hp IS NOT NULL AND no_hp <> '') AS with_phone;
