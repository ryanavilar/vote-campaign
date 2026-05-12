/**
 * TN12 dukungan from xlsx:
 *  Dukungan="dukung" → dukung
 *  Dukungan="tidak" → milih_sebelah  (per user)
 *  Dukungan="ragu_ragu" → ragu_ragu
 */
import XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const APPLY = process.argv.includes("--apply");

function nn(s) { const d = String(s ?? "").replace(/\D+/g, ""); return d ? (d.length < 6 ? d.padStart(6, "0") : d) : ""; }

const wb = XLSX.readFile("/home/ubuntu/.claude/channels/telegram/inbox/1778373031366-AgADOh0AApQN-Fc.xlsx");
const rows = XLSX.utils.sheet_to_json(wb.Sheets["Alumni"], { defval: "" });
const records = rows.map((r) => {
  const v = String(r.Dukungan || "").trim().toLowerCase();
  let d = null;
  if (v === "dukung" || v === "terkonvert") d = "dukung";
  else if (v === "tidak" || v === "milih_sebelah" || v === "sebelah" || v === "lawan") d = "milih_sebelah";
  else if (v === "ragu_ragu" || v === "ragu" || v === "ragu-ragu") d = "ragu_ragu";
  if (!d) return null;
  return { nosis: nn(r.Nosis), nama: String(r["Nama Alumni"] || "").trim(), dukungan: d };
}).filter((r) => r && r.nosis);

console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"} | targets with dukungan: ${records.length}`);

const list = [...new Set(records.map((r) => r.nosis))];
const { data: alumni } = await supabase.from("alumni").select("id, nosis, nama, angkatan").in("nosis", list);
const byNosis = new Map(alumni.map((a) => [a.nosis, a]));
const matched = records.filter((r) => byNosis.has(r.nosis));
const unmatched = records.filter((r) => !byNosis.has(r.nosis));

const ids = matched.map((m) => byNosis.get(m.nosis).id);
const { data: members } = await supabase.from("members").select("id, alumni_id, dukungan, nama").in("alumni_id", ids);
const byAl = new Map(members.map((m) => [m.alumni_id, m]));

const toUpdate = [], noMember = [];
let alreadyDone = 0;
for (const r of matched) {
  const a = byNosis.get(r.nosis);
  const m = byAl.get(a.id);
  if (!m) { noMember.push({ ...r, alumni: a }); continue; }
  if (m.dukungan === r.dukungan) alreadyDone++;
  else toUpdate.push({ id: m.id, nama: a.nama, from: m.dukungan, to: r.dukungan });
}
console.log(`Plan: alreadyDone=${alreadyDone} update=${toUpdate.length} create=${noMember.length} unmatched=${unmatched.length}`);
if (unmatched.length) console.log(`  unmatched NOSIS: ${unmatched.map((u) => u.nosis).join(", ")}`);

if (!APPLY) { console.log("\n→ --apply"); process.exit(0); }

let updated = 0, created = 0;
for (const u of toUpdate) {
  const { error } = await supabase.from("members").update({ dukungan: u.to }).eq("id", u.id);
  if (!error) updated++;
}
if (noMember.length) {
  const { data: maxRow } = await supabase.from("members").select("no").order("no", { ascending: false }).limit(1).single();
  let no = (maxRow.no ?? 0) + 1;
  const insRows = noMember.map((n) => ({
    no: no++, nama: n.alumni.nama, angkatan: n.alumni.angkatan, no_hp: "-", alumni_id: n.alumni.id,
    isi_form_dpt: "Belum", sudah_dikontak: "Belum", masuk_grup: "Belum",
    registrasi_website_dpt: "Belum", status_dpt: null, vote: "Belum", dukungan: n.dukungan,
  }));
  const { data, error } = await supabase.from("members").insert(insRows).select("id");
  if (error) console.error(error.message);
  else created = data.length;
}
console.log(`\n→ updated=${updated}, created=${created}`);
