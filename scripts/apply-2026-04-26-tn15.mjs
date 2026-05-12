/**
 * TN15 update from Copy_of_TN_15... xlsx (sheet "COPY FORM")
 *  - filter Validate=Valid
 *  - eVote Regist=Sudah → isi_form_dpt + registrasi_website_dpt + status_dpt = Sudah
 *  - eVote Regist=Belum/blank → only isi_form_dpt = Sudah
 *  - Pilihan=1 → dukungan=dukung, Pilihan=2 → dukungan=milih_sebelah
 *  - Create member if missing
 */
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const APPLY = process.argv.includes("--apply");
const ANG = 15;
const records = JSON.parse(readFileSync("/tmp/tn15-records.json", "utf8"));
console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"} | TN${ANG}: ${records.length} records\n`);

const { data: alumni } = await supabase.from("alumni").select("id, nosis, nama, angkatan").eq("angkatan", ANG);
const byNosis = new Map(alumni.map((a) => [String(a.nosis), a]));
const matched = [], unmatched = [];
for (const r of records) {
  const a = byNosis.get(String(r.nosis));
  if (a) matched.push({ ...r, alumni: a });
  else unmatched.push(r.nosis);
}
const seen = new Set();
const uniq = matched.filter((r) => seen.has(r.alumni.id) ? false : seen.add(r.alumni.id));

const { data: members } = await supabase
  .from("members").select("id, alumni_id, isi_form_dpt, registrasi_website_dpt, status_dpt, dukungan")
  .in("alumni_id", uniq.map((r) => r.alumni.id));
const byAl = new Map(members.map((m) => [m.alumni_id, m]));

const toUpdate = [], needCreate = [];
let alreadyDone = 0;
for (const r of uniq) {
  const ex = byAl.get(r.alumni.id);
  const targetForm = "Sudah";
  const targetWeb = r.evote ? "Sudah" : null;  // null means don't change web/status if not eVote
  const targetStatus = r.evote ? "Sudah" : null;
  const targetDukungan = r.dukungan;  // dukung, milih_sebelah, or null

  if (!ex) {
    needCreate.push({ alumni: r.alumni, evote: r.evote, dukungan: targetDukungan });
    continue;
  }
  const patch = {};
  if (ex.isi_form_dpt !== "Sudah") patch.isi_form_dpt = "Sudah";
  if (r.evote) {
    if (ex.registrasi_website_dpt !== "Sudah") patch.registrasi_website_dpt = "Sudah";
    if (ex.status_dpt !== "Sudah") patch.status_dpt = "Sudah";
  }
  if (targetDukungan && ex.dukungan !== targetDukungan) patch.dukungan = targetDukungan;
  if (Object.keys(patch).length === 0) alreadyDone++;
  else toUpdate.push({ id: ex.id, patch });
}
console.log(`match=${matched.length}/${records.length} unmatched=${unmatched.length} dedup=${uniq.length}`);
console.log(`already=${alreadyDone} update=${toUpdate.length} create=${needCreate.length}`);
if (unmatched.length) console.log(`unmatched NOSIS: ${unmatched.join(", ")}`);

if (!APPLY) { console.log("\n→ --apply"); process.exit(0); }

let updated = 0, created = 0;
for (const u of toUpdate) {
  const { error } = await supabase.from("members").update(u.patch).eq("id", u.id);
  if (error) console.error(`  ❌ ${u.id}:`, error.message);
  else updated++;
}
if (needCreate.length) {
  const { data: maxRow } = await supabase.from("members").select("no").order("no", { ascending: false }).limit(1).single();
  let no = (maxRow.no ?? 0) + 1;
  const rows = needCreate.map((n) => ({
    no: no++, nama: n.alumni.nama, angkatan: n.alumni.angkatan, no_hp: "-", alumni_id: n.alumni.id,
    isi_form_dpt: "Sudah", sudah_dikontak: "Belum", masuk_grup: "Belum",
    registrasi_website_dpt: n.evote ? "Sudah" : "Belum",
    status_dpt: n.evote ? "Sudah" : null,
    vote: "Belum", dukungan: n.dukungan,
  }));
  const { data, error } = await supabase.from("members").insert(rows).select("id");
  if (error) console.error("create error:", error.message);
  else created = data.length;
}
console.log(`\n→ updated=${updated}, created=${created}`);
