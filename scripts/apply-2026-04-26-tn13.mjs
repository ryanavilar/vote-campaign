/**
 * TN13 from Data Calon Pemilih xlsx:
 *   Sheet "HP VALID" → isi_form_dpt=Sudah (create member if missing)
 *   Sheet "DPT VERIFIED" → handled by apply-web-dpt-by-list.mjs 13 scripts/_tn13-web-dpt.txt
 */
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const APPLY = process.argv.includes("--apply");
const ANG = 13;
const list = readFileSync("/tmp/tn13-form-nosis.txt", "utf8").split("\n").map((l) => l.trim()).filter(Boolean);
console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"} | TN${ANG} form: ${list.length} NOSIS\n`);

const { data: alumni } = await supabase.from("alumni").select("id, nosis, nama, angkatan").eq("angkatan", ANG).in("nosis", list);
const haveAlumni = new Set(alumni.map((a) => a.nosis));
const unmatched = list.filter((n) => !haveAlumni.has(n));
const { data: members } = await supabase.from("members").select("id, alumni_id, nama, isi_form_dpt").in("alumni_id", alumni.map((a) => a.id));
const byAl = new Map(members.map((m) => [m.alumni_id, m]));
const toFlip = [], needCreate = [];
let already = 0;
for (const a of alumni) {
  const ex = byAl.get(a.id);
  if (!ex) needCreate.push(a);
  else if (ex.isi_form_dpt === "Sudah") already++;
  else toFlip.push(ex);
}
console.log(`alumni=${alumni.length}/${list.length} unmatched=${unmatched.length} | already=${already} flip=${toFlip.length} create=${needCreate.length}`);
if (unmatched.length) console.log(`unmatched NOSIS: ${unmatched.join(", ")}`);
if (!APPLY) { console.log("\n→ --apply"); process.exit(0); }

let created = 0, flipped = 0;
if (needCreate.length) {
  const { data: maxRow } = await supabase.from("members").select("no").order("no", { ascending: false }).limit(1).single();
  let no = (maxRow.no ?? 0) + 1;
  const rows = needCreate.map((a) => ({
    no: no++, nama: a.nama, angkatan: a.angkatan, no_hp: "-", alumni_id: a.id,
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
