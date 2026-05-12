/**
 * Update dukungan column dari target_alumni xlsx (sheet "Target Alumni").
 *  Dukungan="Dukung"  → dukungan="dukung"
 *  Dukungan="Sebelah" → dukungan="milih_sebelah"
 *  Empty → skip
 * Matching: NOSIS bila ada, fallback Nama+Angkatan.
 */
import XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const APPLY = process.argv.includes("--apply");

function nn(s) { const d = String(s ?? "").replace(/\D+/g, ""); return d ? (d.length < 6 ? d.padStart(6, "0") : d) : ""; }
function normName(s) {
  return String(s ?? "")
    .toUpperCase().normalize("NFKD")
    .replace(/[‘’'`"?]/g, "")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ").trim();
}

const wb = XLSX.readFile("/tmp/target_alumni3.xlsx");
const rows = XLSX.utils.sheet_to_json(wb.Sheets["Target Alumni"], { defval: "" });
const records = rows.map((r) => {
  const v = String(r.Dukungan || "").trim().toLowerCase();
  let dukungan = null;
  if (v === "dukung") dukungan = "dukung";
  else if (v === "sebelah") dukungan = "milih_sebelah";
  if (!dukungan) return null;
  return {
    nosis: nn(r.NOSIS),
    nama: String(r.Nama || "").trim(),
    angkatan: Number(r.Angkatan),
    dukungan,
  };
}).filter(Boolean);

console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"}`);
console.log(`Marked rows: ${records.length} (dukung=${records.filter((r) => r.dukungan === "dukung").length}, sebelah=${records.filter((r) => r.dukungan === "milih_sebelah").length})\n`);

const angList = [...new Set(records.map((r) => r.angkatan))];
const { data: alumni } = await supabase.from("alumni").select("id, nosis, nama, angkatan").in("angkatan", angList);
const byNosis = new Map(alumni.map((a) => [a.nosis, a]));
const byNameAng = new Map();
for (const a of alumni) {
  const k = `${a.angkatan}|${normName(a.nama)}`;
  if (!byNameAng.has(k)) byNameAng.set(k, []);
  byNameAng.get(k).push(a);
}

const matched = [];
const ambiguous = [];
const unmatched = [];
for (const r of records) {
  let a = null;
  if (r.nosis) a = byNosis.get(r.nosis);
  if (!a) {
    const hits = byNameAng.get(`${r.angkatan}|${normName(r.nama)}`) || [];
    if (hits.length === 1) a = hits[0];
    else if (hits.length > 1) { ambiguous.push({ ...r, hits }); continue; }
  }
  if (a) matched.push({ ...r, alumni: a });
  else unmatched.push(r);
}
console.log(`Matched: ${matched.length}, ambiguous: ${ambiguous.length}, unmatched: ${unmatched.length}`);
if (ambiguous.length) ambiguous.forEach((a) => console.log(`  ambiguous: "${a.nama}" (TN${a.angkatan}) → ${a.hits.map((h) => h.nosis).join(", ")}`));
if (unmatched.length) unmatched.forEach((u) => console.log(`  unmatched: "${u.nama}" (TN${u.angkatan})`));

const ids = matched.map((m) => m.alumni.id);
const { data: members } = await supabase.from("members").select("id, alumni_id, nama, dukungan").in("alumni_id", ids);
const byAl = new Map(members.map((m) => [m.alumni_id, m]));

const toUpdate = [], needCreate = [];
let alreadyDone = 0;
for (const m of matched) {
  const ex = byAl.get(m.alumni.id);
  if (!ex) { needCreate.push(m); continue; }
  if (ex.dukungan === m.dukungan) alreadyDone++;
  else toUpdate.push({ id: ex.id, from: ex.dukungan, to: m.dukungan, nama: m.alumni.nama });
}
console.log(`Plan: alreadyDone=${alreadyDone} update=${toUpdate.length} create=${needCreate.length}`);
toUpdate.slice(0, 10).forEach((u) => console.log(`  ${u.nama}: ${u.from || "-"} → ${u.to}`));

if (!APPLY) { console.log("\n→ --apply"); process.exit(0); }

let updated = 0, created = 0;
for (const u of toUpdate) {
  const { error } = await supabase.from("members").update({ dukungan: u.to }).eq("id", u.id);
  if (!error) updated++;
}
if (needCreate.length) {
  const { data: maxRow } = await supabase.from("members").select("no").order("no", { ascending: false }).limit(1).single();
  let no = (maxRow.no ?? 0) + 1;
  const rows = needCreate.map((m) => ({
    no: no++, nama: m.alumni.nama, angkatan: m.alumni.angkatan, no_hp: "-", alumni_id: m.alumni.id,
    isi_form_dpt: "Belum", sudah_dikontak: "Belum", masuk_grup: "Belum",
    registrasi_website_dpt: "Belum", status_dpt: null, vote: "Belum", dukungan: m.dukungan,
  }));
  const { data, error } = await supabase.from("members").insert(rows).select("id");
  if (error) console.error("create error:", error.message);
  else created = data.length;
}
console.log(`\n→ updated=${updated}, created=${created}`);
