/**
 * TN18 name-based ingestion:
 *   File: tn18-formdpt.xlsx, sheet "Target Alumni"
 *   Format: Nama + status columns (NO NOSIS)
 *   Goal: For rows where Form DPT = "Sudah", flip matching member's isi_form_dpt=Sudah
 *
 * Matching: by normalized name against alumni TN18.
 * Reports ambiguous/unmatched names for human review.
 *
 * Usage:
 *   node --env-file=.env.local scripts/apply-tn18-by-name.mjs [--apply]
 */
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import XLSX from "xlsx";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const APPLY = process.argv.includes("--apply");
const ANG = 18;

function normName(s) {
  return String(s ?? "")
    .toUpperCase()
    .normalize("NFKD")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"}\n`);

const wb = XLSX.read(readFileSync("tn18-formdpt.xlsx"), { type: "buffer" });
const rows = XLSX.utils.sheet_to_json(wb.Sheets["Target Alumni"], { defval: null, raw: false });
const sudahRows = rows.filter((r) => String(r["Form DPT"] || "").trim().toLowerCase() === "sudah");
console.log(`Total rows: ${rows.length}, Form DPT=Sudah: ${sudahRows.length}`);

const { data: alumniAll } = await supabase
  .from("alumni")
  .select("id, nosis, nama, angkatan")
  .eq("angkatan", ANG);
console.log(`Alumni TN${ANG}: ${alumniAll.length}`);

const alumniByNorm = new Map();
for (const a of alumniAll) {
  const k = normName(a.nama);
  if (!alumniByNorm.has(k)) alumniByNorm.set(k, []);
  alumniByNorm.get(k).push(a);
}

const matched = [];
const ambiguous = [];
const unmatched = [];
for (const r of sudahRows) {
  const k = normName(r.Nama);
  if (!k) continue;
  const hits = alumniByNorm.get(k);
  if (!hits || hits.length === 0) unmatched.push(r.Nama);
  else if (hits.length > 1) ambiguous.push({ name: r.Nama, hits });
  else matched.push({ row: r, alumni: hits[0] });
}
console.log(`Name-matched: ${matched.length}, ambiguous: ${ambiguous.length}, unmatched: ${unmatched.length}`);

if (unmatched.length) {
  console.log("\nUnmatched names (no alumni in TN18 with this name):");
  unmatched.forEach((n) => console.log(`  - ${n}`));
}
if (ambiguous.length) {
  console.log("\nAmbiguous names (multiple alumni match):");
  ambiguous.forEach((a) => console.log(`  - ${a.name} → ${a.hits.map((h) => h.nosis).join(", ")}`));
}

const alumniIds = matched.map((m) => m.alumni.id);
const { data: members } = await supabase
  .from("members")
  .select("id, alumni_id, nama, isi_form_dpt")
  .in("alumni_id", alumniIds);
const memberByAlumni = new Map(members.map((m) => [m.alumni_id, m]));

const needCreate = matched.filter((m) => !memberByAlumni.has(m.alumni.id));
const toFlip = members.filter((m) => m.isi_form_dpt !== "Sudah");
const alreadySudah = members.length - toFlip.length;
console.log(`\nMembers existing: ${members.length}, already Sudah: ${alreadySudah}, flip needed: ${toFlip.length}, missing member (need create): ${needCreate.length}`);

if (needCreate.length) {
  console.log("\nWill create:");
  needCreate.slice(0, 10).forEach((m) => console.log(`  + ${m.alumni.nosis} "${m.alumni.nama}"`));
  if (needCreate.length > 10) console.log(`  ... +${needCreate.length - 10} more`);
}

if (!APPLY) {
  console.log("\n→ Re-run with --apply to write.");
  process.exit(0);
}

// APPLY
let created = 0, flipped = 0, errCnt = 0;

if (needCreate.length) {
  const { data: maxRow } = await supabase
    .from("members")
    .select("no").order("no", { ascending: false }).limit(1).single();
  let nextNo = (maxRow.no ?? 0) + 1;

  const rowsToInsert = needCreate.map((m) => ({
    no: nextNo++,
    nama: m.alumni.nama,
    angkatan: m.alumni.angkatan,
    no_hp: "-",
    alumni_id: m.alumni.id,
    isi_form_dpt: "Sudah",
    sudah_dikontak: "Belum",
    masuk_grup: "Belum",
    registrasi_website_dpt: "Belum",
    status_dpt: null,
    vote: "Belum",
    dukungan: null,
  }));
  const { data, error } = await supabase.from("members").insert(rowsToInsert).select("id");
  if (error) console.error(`  ❌ create:`, error.message);
  else created = data.length;
}

for (const m of toFlip) {
  const { error } = await supabase.from("members").update({ isi_form_dpt: "Sudah" }).eq("id", m.id);
  if (error) { errCnt++; console.error(`  ❌ flip "${m.nama}": ${error.message}`); }
  else flipped++;
}

console.log(`\n→ Applied: created=${created}, flipped=${flipped}, errors=${errCnt}`);
