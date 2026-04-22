/**
 * Create member row for TN32 M. Diandra Adhi Makayasa (real NOSIS 2110008)
 * whose form submission used typo NOSIS 2100008, so auto-create misses him.
 */
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const APPLY = process.argv.includes("--apply");

const { data: alumni } = await supabase
  .from("alumni").select("id, nosis, nama, angkatan").eq("nosis", "2110008").single();
if (!alumni) { console.log(`❌ alumni 2110008 not found`); process.exit(1); }

const { data: existing } = await supabase
  .from("members").select("id").eq("alumni_id", alumni.id).maybeSingle();
if (existing) { console.log(`✓ member already exists for ${alumni.nama}`); process.exit(0); }

const { data: maxRow } = await supabase.from("members").select("no").order("no", { ascending: false }).limit(1).single();
const nextNo = (maxRow.no ?? 0) + 1;

const phone = "6282146468858";

const row = {
  no: nextNo,
  nama: alumni.nama,
  angkatan: alumni.angkatan,
  no_hp: phone,
  alumni_id: alumni.id,
  isi_form_dpt: "Sudah",
  sudah_dikontak: "Belum",
  masuk_grup: "Belum",
  registrasi_website_dpt: "Belum",
  status_dpt: null,
  vote: "Belum",
  dukungan: null,
};

console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"}`);
console.log(`+ no=${nextNo} TN${alumni.angkatan} ${alumni.nosis} "${alumni.nama}" phone=${phone}`);

if (APPLY) {
  const { error } = await supabase.from("members").insert(row);
  if (error) console.log(`❌ ${error.message}`);
  else console.log(`✓ created`);
} else {
  console.log(`\n→ Re-run with --apply to write.`);
}
