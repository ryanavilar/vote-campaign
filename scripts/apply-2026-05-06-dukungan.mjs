/**
 * Update dukungan dari xlsx alumni-2026-05-06 (sheet Alumni).
 * Cuma update yang Dukungan='dukung' (bukan empty) — match by NOSIS.
 */
import XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const APPLY = process.argv.includes("--apply");

function nn(s) { const d = String(s ?? "").replace(/\D+/g, ""); return d ? (d.length < 6 ? d.padStart(6, "0") : d) : ""; }

const wb = XLSX.readFile("/home/ubuntu/.claude/channels/telegram/inbox/1778048842011-AgAD1CMAAuc70Fc.xlsx");
const rows = XLSX.utils.sheet_to_json(wb.Sheets["Alumni"], { defval: "" });

const records = rows.map((r) => {
  const v = String(r.Dukungan || "").trim().toLowerCase();
  let dukungan = null;
  if (v === "dukung") dukungan = "dukung";
  else if (v === "terkonvert") dukungan = "terkonvert";
  else if (v === "ragu_ragu" || v === "ragu" || v === "ragu-ragu") dukungan = "ragu_ragu";
  else if (v === "milih_sebelah" || v === "sebelah" || v === "lawan") dukungan = "milih_sebelah";
  if (!dukungan) return null;
  return { nosis: nn(r.Nosis), nama: String(r["Nama Alumni"] || "").trim(), dukungan };
}).filter((r) => r && r.nosis);

console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"} | total rows: ${rows.length}, with dukungan: ${records.length}`);

const list = [...new Set(records.map((r) => r.nosis))];
const { data: alumni } = await supabase.from("alumni").select("id, nosis, nama, angkatan").in("nosis", list);
const byNosis = new Map(alumni.map((a) => [a.nosis, a]));
const matched = records.filter((r) => byNosis.has(r.nosis));
const unmatched = records.filter((r) => !byNosis.has(r.nosis));

const ids = matched.map((m) => byNosis.get(m.nosis).id);
const { data: members } = await supabase.from("members").select("id, alumni_id, nama, dukungan").in("alumni_id", ids);
const byAl = new Map(members.map((m) => [m.alumni_id, m]));

const toUpdate = [];
let alreadyDone = 0;
const noMember = [];
for (const r of matched) {
  const a = byNosis.get(r.nosis);
  const m = byAl.get(a.id);
  if (!m) { noMember.push(r); continue; }
  if (m.dukungan === r.dukungan) alreadyDone++;
  else toUpdate.push({ id: m.id, nama: a.nama, from: m.dukungan, to: r.dukungan });
}
console.log(`Plan: alreadyDone=${alreadyDone} update=${toUpdate.length} no-member=${noMember.length} unmatched-nosis=${unmatched.length}`);
toUpdate.slice(0, 10).forEach((u) => console.log(`  ${u.nama}: ${u.from || "-"} → ${u.to}`));
if (unmatched.length) unmatched.forEach((u) => console.log(`  unmatched nosis: ${u.nosis} ${u.nama}`));

if (!APPLY) { console.log("\n→ --apply"); process.exit(0); }

let updated = 0;
for (const u of toUpdate) {
  const { error } = await supabase.from("members").update({ dukungan: u.to }).eq("id", u.id);
  if (!error) updated++;
}
console.log(`\n→ updated=${updated}`);
