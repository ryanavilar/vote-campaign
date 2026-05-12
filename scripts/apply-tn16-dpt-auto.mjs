/**
 * TN3 DPT verified PDF — auto set form+web+status, create member if missing.
 */
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const APPLY = process.argv.includes("--apply");
const ANG = 16;
const list = readFileSync(`scripts/_tn${ANG}-web-dpt.txt`, "utf8").split("\n").map((l) => l.trim()).filter(Boolean);
console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"} | TN${ANG} NOSIS: ${list.length}\n`);

const { data: alumni } = await supabase.from("alumni").select("id, nosis, nama, angkatan").eq("angkatan", ANG).in("nosis", list);
const ids = alumni.map((a) => a.id);
const { data: members } = await supabase.from("members").select("id, alumni_id, isi_form_dpt, registrasi_website_dpt, status_dpt").in("alumni_id", ids);
const byAl = new Map(members.map((m) => [m.alumni_id, m]));
const toUpdate = [], needCreate = [];
let already = 0;
for (const a of alumni) {
  const ex = byAl.get(a.id);
  if (!ex) { needCreate.push(a); continue; }
  if (ex.isi_form_dpt === "Sudah" && ex.registrasi_website_dpt === "Sudah" && ex.status_dpt === "Sudah") { already++; continue; }
  toUpdate.push(ex);
}
const unmatched = list.filter((n) => !alumni.find((a) => a.nosis === n));
console.log(`alumni=${alumni.length}/${list.length} unmatched=${unmatched.length} | already=${already} update=${toUpdate.length} create=${needCreate.length}`);
if (unmatched.length) console.log(`  unmatched NOSIS: ${unmatched.join(", ")}`);

if (!APPLY) { console.log("\n→ --apply"); process.exit(0); }

let updated = 0, created = 0;
for (const m of toUpdate) {
  const { error } = await supabase.from("members").update({ isi_form_dpt: "Sudah", registrasi_website_dpt: "Sudah", status_dpt: "Sudah" }).eq("id", m.id);
  if (!error) updated++;
}
if (needCreate.length) {
  const { data: maxRow } = await supabase.from("members").select("no").order("no", { ascending: false }).limit(1).single();
  let no = (maxRow.no ?? 0) + 1;
  const rows = needCreate.map((a) => ({
    no: no++, nama: a.nama, angkatan: a.angkatan, no_hp: "-", alumni_id: a.id,
    isi_form_dpt: "Sudah", sudah_dikontak: "Belum", masuk_grup: "Belum",
    registrasi_website_dpt: "Sudah", status_dpt: "Sudah", vote: "Belum", dukungan: null,
  }));
  const { data, error } = await supabase.from("members").insert(rows).select("id");
  if (error) console.error("create error:", error.message);
  else created = data.length;
}
console.log(`\n→ updated=${updated}, created=${created}`);
