/**
 * TN18 (atmosphere xlsx, sheet "All")
 *  Validasi Gform=Valid → isi_form_dpt=Sudah
 *  Sudah Daftar Evote=Sudah → registrasi_website_dpt=Sudah
 *  Verified Evote=Done → status_dpt=Sudah
 *  Mendukung=Ya → dukungan=dukung
 *  Mendukung=Tidak → dukungan=milih_sebelah
 *  Create member if missing.
 */
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const APPLY = process.argv.includes("--apply");
const ANG = 18;
const records = JSON.parse(readFileSync("/tmp/atmosphere-records.json", "utf8"));
console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"} | TN${ANG}: ${records.length}\n`);

const { data: alumni } = await supabase.from("alumni").select("id, nosis, nama, angkatan").eq("angkatan", ANG);
const byNosis = new Map(alumni.map((a) => [String(a.nosis), a]));
const matched = [], unmatched = [];
for (const r of records) {
  const a = byNosis.get(String(r.nosis));
  if (a) matched.push({ ...r, alumni: a });
  else unmatched.push(r.nosis);
}
const seen = new Set();
const uniq = matched.filter((m) => seen.has(m.alumni.id) ? false : seen.add(m.alumni.id));
const { data: members } = await supabase.from("members").select("id, alumni_id, isi_form_dpt, registrasi_website_dpt, status_dpt, dukungan").in("alumni_id", uniq.map((r) => r.alumni.id));
const byAl = new Map(members.map((m) => [m.alumni_id, m]));

const toUpdate = [], needCreate = [];
let alreadyDone = 0;
for (const r of uniq) {
  const ex = byAl.get(r.alumni.id);
  if (!ex) { needCreate.push(r); continue; }
  const patch = {};
  if (r.valid && ex.isi_form_dpt !== "Sudah") patch.isi_form_dpt = "Sudah";
  if (r.evoteReg && ex.registrasi_website_dpt !== "Sudah") patch.registrasi_website_dpt = "Sudah";
  if (r.verified && ex.status_dpt !== "Sudah") patch.status_dpt = "Sudah";
  if (r.dukungan && ex.dukungan !== r.dukungan) patch.dukungan = r.dukungan;
  if (Object.keys(patch).length === 0) alreadyDone++;
  else toUpdate.push({ id: ex.id, patch });
}
console.log(`match=${matched.length}/${records.length} unmatched=${unmatched.length} | alreadyDone=${alreadyDone} update=${toUpdate.length} create=${needCreate.length}`);
if (unmatched.length) console.log(`unmatched NOSIS: ${unmatched.join(", ")}`);

if (!APPLY) { console.log("\n→ --apply"); process.exit(0); }

let updated = 0, created = 0;
for (const u of toUpdate) {
  const { error } = await supabase.from("members").update(u.patch).eq("id", u.id);
  if (!error) updated++;
}
if (needCreate.length) {
  const { data: maxRow } = await supabase.from("members").select("no").order("no", { ascending: false }).limit(1).single();
  let no = (maxRow.no ?? 0) + 1;
  const rows = needCreate.map((r) => ({
    no: no++, nama: r.alumni.nama, angkatan: r.alumni.angkatan, no_hp: "-", alumni_id: r.alumni.id,
    isi_form_dpt: r.valid ? "Sudah" : "Belum",
    sudah_dikontak: "Belum", masuk_grup: "Belum",
    registrasi_website_dpt: r.evoteReg ? "Sudah" : "Belum",
    status_dpt: r.verified ? "Sudah" : null,
    vote: "Belum", dukungan: r.dukungan,
  }));
  const { data, error } = await supabase.from("members").insert(rows).select("id");
  if (error) console.error("create error:", error.message);
  else created = data.length;
}
console.log(`\n→ updated=${updated}, created=${created}`);
