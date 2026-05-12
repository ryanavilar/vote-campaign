import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const APPLY = process.argv.includes("--apply");
const ANG = 30;
const records = JSON.parse(readFileSync(`/tmp/tn${ANG}-form-records.json`, "utf8"));
console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"} | TN${ANG}: ${records.length}\n`);

const { data: alumni } = await supabase.from("alumni").select("id, nosis, nama, angkatan").eq("angkatan", ANG);
const byNosis = new Map(alumni.map((a) => [String(a.nosis), a]));
const matched = [], unmatched = [];
for (const r of records) {
  const a = byNosis.get(String(r.nosis));
  if (a) matched.push({ alumni: a, phone: r.phone });
  else unmatched.push(r.nosis);
}
const seen = new Set();
const uniq = matched.filter((m) => seen.has(m.alumni.id) ? false : seen.add(m.alumni.id));
const { data: members } = await supabase.from("members").select("id, alumni_id, nama, isi_form_dpt").in("alumni_id", uniq.map((m) => m.alumni.id));
const byAl = new Map(members.map((m) => [m.alumni_id, m]));
const toFlip = [], needCreate = [];
let already = 0;
for (const m of uniq) {
  const ex = byAl.get(m.alumni.id);
  if (!ex) needCreate.push(m);
  else if (ex.isi_form_dpt === "Sudah") already++;
  else toFlip.push(ex);
}
console.log(`match=${matched.length}/${records.length} unmatched=${unmatched.length} | already=${already} flip=${toFlip.length} create=${needCreate.length}`);
if (unmatched.length) console.log(`unmatched NOSIS: ${unmatched.join(", ")}`);
if (!APPLY) { console.log("\n→ --apply"); process.exit(0); }
let created = 0, flipped = 0;
if (needCreate.length) {
  const { data: maxRow } = await supabase.from("members").select("no").order("no", { ascending: false }).limit(1).single();
  let no = (maxRow.no ?? 0) + 1;
  const rows = needCreate.map((m) => ({
    no: no++, nama: m.alumni.nama, angkatan: m.alumni.angkatan, no_hp: m.phone || "-", alumni_id: m.alumni.id,
    isi_form_dpt: "Sudah", sudah_dikontak: "Belum", masuk_grup: "Belum",
    registrasi_website_dpt: "Belum", status_dpt: null, vote: "Belum", dukungan: null,
  }));
  const { data, error } = await supabase.from("members").insert(rows).select("id");
  if (error) console.error("create error:", error.message);
  else created = data.length;
}
for (const m of toFlip) {
  const { error } = await supabase.from("members").update({ isi_form_dpt: "Sudah" }).eq("id", m.id);
  if (!error) flipped++;
}
console.log(`\n→ created=${created}, flipped=${flipped}`);
