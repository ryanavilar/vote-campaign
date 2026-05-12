/**
 * Update dukungan dari 05092026_DataASD.xlsx (sheet Detail).
 * Vote 01?='y' → dukungan='dukung'. Match by NOSIS.
 */
import XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const APPLY = process.argv.includes("--apply");

const wb = XLSX.readFile("/home/ubuntu/.claude/channels/telegram/inbox/1778296119453-AgADShsAAh_U8Fc.xlsx");
const rows = XLSX.utils.sheet_to_json(wb.Sheets["Detail"], { defval: "" });
const targets = rows.filter((r) => String(r["Vote 01?"] || "").trim().toLowerCase() === "y" && String(r.NOSIS || "").trim());

console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"} | Vote 01=y rows with NOSIS: ${targets.length}`);

const list = [...new Set(targets.map((r) => String(r.NOSIS).trim()))];
const { data: alumni } = await supabase.from("alumni").select("id, nosis, nama, angkatan").in("nosis", list);
const byNosis = new Map(alumni.map((a) => [a.nosis, a]));
const { data: members } = await supabase.from("members").select("id, alumni_id, dukungan, nama").in("alumni_id", alumni.map((a) => a.id));
const byAl = new Map(members.map((m) => [m.alumni_id, m]));

const toUpdate = [];
let alreadyDone = 0;
const noMember = [];
const unmatchedNosis = [];
for (const r of targets) {
  const a = byNosis.get(String(r.NOSIS).trim());
  if (!a) { unmatchedNosis.push(r.NOSIS); continue; }
  const m = byAl.get(a.id);
  if (!m) { noMember.push({ ...r, alumni: a }); continue; }
  if (m.dukungan === "dukung" || m.dukungan === "terkonvert") alreadyDone++;
  else toUpdate.push({ id: m.id, nama: a.nama, from: m.dukungan });
}
console.log(`Plan: alreadyDukung=${alreadyDone} update→dukung=${toUpdate.length} noMember=${noMember.length} unmatchedNosis=${unmatchedNosis.length}`);
if (unmatchedNosis.length) console.log(`  unmatched NOSIS: ${unmatchedNosis.join(", ")}`);
if (noMember.length) console.log(`  alumni tanpa member (akan dibuat):`, noMember.map((n) => `${n.NOSIS}/${n.alumni.nama}`).join(", "));

if (!APPLY) { console.log("\n→ --apply"); process.exit(0); }

let updated = 0, created = 0;
for (const u of toUpdate) {
  const { error } = await supabase.from("members").update({ dukungan: "dukung" }).eq("id", u.id);
  if (!error) updated++;
}
if (noMember.length) {
  const { data: maxRow } = await supabase.from("members").select("no").order("no", { ascending: false }).limit(1).single();
  let no = (maxRow.no ?? 0) + 1;
  const insRows = noMember.map((n) => ({
    no: no++, nama: n.alumni.nama, angkatan: n.alumni.angkatan, no_hp: "-", alumni_id: n.alumni.id,
    isi_form_dpt: "Belum", sudah_dikontak: "Belum", masuk_grup: "Belum",
    registrasi_website_dpt: "Belum", status_dpt: null, vote: "Belum", dukungan: "dukung",
  }));
  const { data, error } = await supabase.from("members").insert(insRows).select("id");
  if (error) console.error("create error:", error.message);
  else created = data.length;
}
console.log(`\n→ updated=${updated}, created=${created}`);
