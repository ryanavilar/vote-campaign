/**
 * TN21 form processing (no PDF yet):
 *   - From tn21-formdpt.xlsx (valid-only):
 *     - Auto-create member rows for alumni with valid form but no member
 *     - Set isi_form_dpt = "Sudah"
 *
 * Usage:
 *   node --env-file=.env.local scripts/apply-tn21-form-only.mjs [--apply]
 */
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import XLSX from "xlsx";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const APPLY = process.argv.includes("--apply");
const ANG = 21;

function normNosis(s) {
  const digits = String(s ?? "").replace(/\D+/g, "");
  if (!digits) return "";
  return digits.length < 6 ? digits.padStart(6, "0") : digits;
}
function normPhone(p) {
  if (!p) return null;
  let s = String(p).replace(/\s+/g, "").replace(/[^\d+]/g, "");
  if (s.startsWith("0")) s = "62" + s.slice(1);
  if (s.startsWith("+")) s = s.slice(1);
  return s || null;
}

console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"}\n`);

console.log("=== Form DPT (tn21-formdpt.xlsx, valid-only) ===");
const wb = XLSX.read(readFileSync("scripts/tn21-formdpt.xlsx"), { type: "buffer" });
const rows = XLSX.utils.sheet_to_json(wb.Sheets["Form responses 1"], { defval: null, raw: false });
const valid = rows.filter((r) => String(r.Validate || "").trim().toLowerCase() === "valid");
console.log(`Total rows: ${rows.length}, valid: ${valid.length}`);

const phoneByNosis = new Map();
const nosisSet = new Set();
for (const r of valid) {
  const n = normNosis(r["NOSIS (penulisan tanpa spasi e.g: 999999)"]);
  if (!n) continue;
  nosisSet.add(n);
  const p = normPhone(r["Nomor WhatsApp yang terdaftar di Grup Angkatan"]);
  if (p && !phoneByNosis.has(n)) phoneByNosis.set(n, p);
}
const formNosisList = [...nosisSet];
console.log(`Unique NOSIS in valid form: ${formNosisList.length}`);

const { data: alumniForm } = await supabase
  .from("alumni")
  .select("id, nosis, nama, angkatan")
  .eq("angkatan", ANG)
  .in("nosis", formNosisList);
const matchedFormNosis = new Set(alumniForm.map((a) => a.nosis));
const unmatchedForm = formNosisList.filter((n) => !matchedFormNosis.has(n));
if (unmatchedForm.length) console.log(`Unmatched NOSIS: ${unmatchedForm.join(", ")}`);

const { data: formMembers } = await supabase
  .from("members")
  .select("id, alumni_id, nama, isi_form_dpt, no_hp")
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
  no_hp: phoneByNosis.get(a.nosis) || "-",
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

if (!APPLY) {
  console.log("\n→ Re-run with --apply to write.");
  process.exit(0);
}

let created = 0, updForm = 0, errCnt = 0;

if (toCreate.length) {
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

console.log(`\n→ Applied: created=${created}, formFlip=${updForm}, errors=${errCnt}`);
