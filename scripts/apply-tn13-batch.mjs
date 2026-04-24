/**
 * TN13 batch from DOC-20260423-WA0021.xlsx:
 *   - Sheet "HP VALID" (Nosis, Nama): set isi_form_dpt = "Sudah" (create member if missing)
 *   - Sheet "DPT VERIFIED" (No, NIS, Nama, ...): set registrasi_website_dpt + status_dpt = "Sudah"
 *
 * Usage:
 *   node --env-file=.env.local scripts/apply-tn13-batch.mjs [--apply]
 */
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import XLSX from "xlsx";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const APPLY = process.argv.includes("--apply");
const ANG = 13;

function normNosis(s) {
  const digits = String(s ?? "").replace(/\D+/g, "");
  if (!digits) return "";
  return digits.length < 6 ? digits.padStart(6, "0") : digits;
}

console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"} (ANGKATAN ${ANG})\n`);

const wb = XLSX.read(readFileSync("tn13-dpt-verified.xlsx"), { type: "buffer" });

// ---------- Sheet 1: HP VALID (form DPT) ----------
console.log("=== STEP 1: Form DPT from sheet 'HP VALID' ===");
const shForm = wb.Sheets["HP VALID"];
const formRows = XLSX.utils.sheet_to_json(shForm, { header: 1, defval: "", raw: false });
// row 0 = header. col 0 = Nosis, col 1 = Nama.
const formNosis = new Set();
const formNameByNosis = new Map();
for (let i = 1; i < formRows.length; i++) {
  const n = normNosis(formRows[i][0]);
  if (!n) continue;
  formNosis.add(n);
  if (!formNameByNosis.has(n)) formNameByNosis.set(n, String(formRows[i][1] || "").trim());
}
const formNosisList = [...formNosis];
console.log(`HP VALID entries: ${formNosisList.length}`);

const { data: alumniForm } = await supabase
  .from("alumni")
  .select("id, nosis, nama, angkatan")
  .eq("angkatan", ANG)
  .in("nosis", formNosisList);
const matchedFormNosis = new Set(alumniForm.map((a) => a.nosis));
const unmatchedForm = formNosisList.filter((n) => !matchedFormNosis.has(n));
if (unmatchedForm.length) console.log(`Unmatched (not in alumni ANG13): ${unmatchedForm.length} → ${unmatchedForm.slice(0,10).join(", ")}${unmatchedForm.length>10?'...':''}`);

const { data: formMembers } = await supabase
  .from("members")
  .select("id, alumni_id, nama, isi_form_dpt")
  .in("alumni_id", alumniForm.map((a) => a.id));
const memberByAlumni = new Map(formMembers.map((m) => [m.alumni_id, m]));
const missingAlumni = alumniForm.filter((a) => !memberByAlumni.has(a.id));
console.log(`Alumni matched: ${alumniForm.length}, have member: ${formMembers.length}, need create: ${missingAlumni.length}`);

let nextNo = 0;
if (missingAlumni.length) {
  const { data: maxRow } = await supabase
    .from("members")
    .select("no").order("no", { ascending: false }).limit(1).single();
  nextNo = (maxRow.no ?? 0) + 1;
  console.log(`Starting no: ${nextNo}`);
}

const toCreate = missingAlumni.map((a) => ({
  no: nextNo++,
  nama: a.nama,
  angkatan: a.angkatan,
  no_hp: "-",
  alumni_id: a.id,
  isi_form_dpt: "Sudah",
  sudah_dikontak: "Belum",
  masuk_grup: "Belum",
  registrasi_website_dpt: "Belum",
  status_dpt: null,
  vote: "Belum",
  dukungan: null,
}));
const toUpdateForm = formMembers.filter((m) => m.isi_form_dpt !== "Sudah");
console.log(`Create: ${toCreate.length}, form-flip: ${toUpdateForm.length}, already Sudah: ${formMembers.length - toUpdateForm.length}`);

// ---------- Sheet 2: DPT VERIFIED (web + status) ----------
console.log("\n=== STEP 2: Web DPT + Status DPT from sheet 'DPT VERIFIED' ===");
const shDpt = wb.Sheets["DPT VERIFIED"];
const dptRows = XLSX.utils.sheet_to_json(shDpt, { header: 1, defval: "", raw: false });
// row 0 = header. col 1 = NIS.
const dptSet = new Set();
for (let i = 1; i < dptRows.length; i++) {
  const n = normNosis(dptRows[i][1]);
  if (n) dptSet.add(n);
}
console.log(`DPT VERIFIED entries: ${dptSet.size}`);

const { data: alumniDpt } = await supabase
  .from("alumni")
  .select("id, nosis, nama, angkatan")
  .eq("angkatan", ANG)
  .in("nosis", [...dptSet]);
const unmatchedDpt = [...dptSet].filter((n) => !alumniDpt.some((a) => a.nosis === n));
if (unmatchedDpt.length) console.log(`Unmatched DPT NOSIS: ${unmatchedDpt.length} → ${unmatchedDpt.slice(0,10).join(", ")}${unmatchedDpt.length>10?'...':''}`);

const dptAlumniIds = alumniDpt.map((a) => a.id);
const { data: dptMembers } = await supabase
  .from("members")
  .select("id, alumni_id, nama, registrasi_website_dpt, status_dpt")
  .in("alumni_id", dptAlumniIds);
const createAlumniIds = new Set(toCreate.map((r) => r.alumni_id));
const dptCovered = new Map(dptMembers.map((m) => [m.alumni_id, m]));
const dptPending = alumniDpt.filter((a) => !dptCovered.has(a.id));
const dptPendingWillCreate = dptPending.filter((a) => createAlumniIds.has(a.id));
const dptPendingNoMember = dptPending.filter((a) => !createAlumniIds.has(a.id));

console.log(`DPT alumni: ${alumniDpt.length}, have member: ${dptMembers.length}, will-create-then-update: ${dptPendingWillCreate.length}, no member at all: ${dptPendingNoMember.length}`);
if (dptPendingNoMember.length) {
  console.log("  WARNING — DPT NOSIS with no valid form (won't auto-create):");
  dptPendingNoMember.forEach((a) => console.log(`    ${a.nosis} "${a.nama}"`));
}

const toUpdateDptExisting = dptMembers.filter(
  (m) => m.registrasi_website_dpt !== "Sudah" || m.status_dpt !== "Sudah"
);
console.log(`DPT updates on existing: ${toUpdateDptExisting.length}`);

if (!APPLY) {
  console.log("\n→ Re-run with --apply to write.");
  process.exit(0);
}

// ---------- APPLY ----------
let created = 0, updForm = 0, updDpt = 0, errCnt = 0;

if (toCreate.length) {
  for (const r of toCreate) {
    if (alumniDpt.some((a) => a.id === r.alumni_id)) {
      r.registrasi_website_dpt = "Sudah";
      r.status_dpt = "Sudah";
    }
  }
  for (let i = 0; i < toCreate.length; i += 200) {
    const chunk = toCreate.slice(i, i + 200);
    const { data, error } = await supabase.from("members").insert(chunk).select("id");
    if (error) {
      console.error(`  ❌ create batch:`, error.message);
      for (const item of chunk) {
        const { error: e2 } = await supabase.from("members").insert(item);
        if (e2) { errCnt++; console.error(`    ❌ ${item.nama}: ${e2.message}`); }
        else created++;
      }
    } else created += data.length;
  }
}

for (const m of toUpdateForm) {
  const { error } = await supabase.from("members").update({ isi_form_dpt: "Sudah" }).eq("id", m.id);
  if (error) { errCnt++; console.error(`  ❌ form "${m.nama}": ${error.message}`); }
  else updForm++;
}

for (const m of toUpdateDptExisting) {
  const { error } = await supabase.from("members").update({ registrasi_website_dpt: "Sudah", status_dpt: "Sudah" }).eq("id", m.id);
  if (error) { errCnt++; console.error(`  ❌ dpt "${m.nama}": ${error.message}`); }
  else updDpt++;
}

console.log(`\n→ Applied: created=${created}, formFlip=${updForm}, dptUpdate=${updDpt}, errors=${errCnt}`);
if (dptPendingNoMember.length) {
  console.log(`NOTE: ${dptPendingNoMember.length} DPT NOSIS had no member row (no form) — not updated.`);
}
