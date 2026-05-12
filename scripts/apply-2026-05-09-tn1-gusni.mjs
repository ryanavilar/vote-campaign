import XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const APPLY = process.argv.includes("--apply");

function nn(s) { const d = String(s ?? "").replace(/\D+/g, ""); return d ? (d.length < 6 ? d.padStart(6, "0") : d) : ""; }

const wb = XLSX.readFile("/home/ubuntu/.claude/channels/telegram/inbox/1778296307724-AgADSxsAAh_U8Fc.xlsx");
const rows = XLSX.utils.sheet_to_json(wb.Sheets["Alumni"], { defval: "" });
// Vote 01 marker is column "No 1" with value 1. Match by NOSIS, must have NOSIS.
const targets = rows
  .filter((r) => String(r["No 1"]).trim() === "1" && nn(r.Nosis))
  .map((r) => ({ nosis: nn(r.Nosis), nama: String(r["Nama Alumni"] || "").trim() }));

console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"} | targets: ${targets.length}`);

const list = [...new Set(targets.map((t) => t.nosis))];
const { data: alumni } = await supabase.from("alumni").select("id, nosis, nama, angkatan").in("nosis", list);
const byNosis = new Map(alumni.map((a) => [a.nosis, a]));
const { data: members } = await supabase.from("members").select("id, alumni_id, dukungan, nama").in("alumni_id", alumni.map((a) => a.id));
const byAl = new Map(members.map((m) => [m.alumni_id, m]));

const toUpdate = [], noMember = [], unmatched = [];
let alreadyDone = 0;
for (const t of targets) {
  const a = byNosis.get(t.nosis);
  if (!a) { unmatched.push(t.nosis); continue; }
  const m = byAl.get(a.id);
  if (!m) { noMember.push({ ...t, alumni: a }); continue; }
  if (m.dukungan === "dukung" || m.dukungan === "terkonvert") alreadyDone++;
  else toUpdate.push({ id: m.id, nama: a.nama });
}
console.log(`Plan: alreadyDukung=${alreadyDone} update=${toUpdate.length} createMember=${noMember.length} unmatchedNosis=${unmatched.length}`);
if (unmatched.length) console.log(`  unmatched: ${unmatched.join(", ")}`);

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
  if (error) console.error(error.message);
  else created = data.length;
}
console.log(`\n→ updated=${updated}, created=${created}`);
