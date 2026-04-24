/**
 * TN15 eVote ingestion:
 *   For each row where Validate=Valid AND `eVote Regist`=Sudah:
 *     - Auto-create member row if alumni has no linked member (per mandatory DPT
 *       form rule)
 *     - Set isi_form_dpt=Sudah AND registrasi_website_dpt=Sudah
 *     - Do NOT touch status_dpt
 *
 * Usage:
 *   node --env-file=.env.local scripts/apply-tn15-evote-form-web.mjs [--apply]
 */
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import XLSX from "xlsx";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const APPLY = process.argv.includes("--apply");

const FILE = "tn15-form-evote.xlsx";
const SHEET = "COPY FORM";
const ANG = 15;

function normNosis(s) {
  const digits = String(s ?? "").replace(/\D+/g, "");
  if (!digits) return "";
  return digits.length < 6 ? digits.padStart(6, "0") : digits;
}

console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"}\n`);

const wb = XLSX.read(readFileSync(FILE), { type: "buffer" });
const rows = XLSX.utils.sheet_to_json(wb.Sheets[SHEET], { defval: null, raw: false });

const valid = rows.filter(
  (r) =>
    String(r.Validate || "").trim().toLowerCase() === "valid" &&
    String(r["eVote Regist"] || "").trim().toLowerCase() === "sudah"
);
console.log(`Total rows: ${rows.length}, valid+eVote Sudah: ${valid.length}`);

const nosisSet = new Set();
for (const r of valid) {
  const n = normNosis(r.NOSIS);
  if (n) nosisSet.add(n);
}
const nosisList = [...nosisSet];
console.log(`Unique NOSIS: ${nosisList.length}`);

const { data: alumni, error: eAlum } = await supabase
  .from("alumni")
  .select("id, nosis, nama, angkatan")
  .eq("angkatan", ANG)
  .in("nosis", nosisList);
if (eAlum) throw eAlum;
console.log(`Alumni TN${ANG} matched: ${alumni.length}`);

const matchedNosis = new Set(alumni.map((a) => a.nosis));
const unmatched = nosisList.filter((n) => !matchedNosis.has(n));
if (unmatched.length) {
  console.log(`Unmatched NOSIS (${unmatched.length}): ${unmatched.join(", ")}`);
}

const { data: members, error: eMem } = await supabase
  .from("members")
  .select("id, alumni_id, nama, isi_form_dpt, registrasi_website_dpt")
  .in("alumni_id", alumni.map((a) => a.id));
if (eMem) throw eMem;

const memberByAlumni = new Map(members.map((m) => [m.alumni_id, m]));
const alumniWithoutMember = alumni.filter((a) => !memberByAlumni.has(a.id));

console.log(`Members already linked: ${members.length}`);
console.log(`Alumni needing member create: ${alumniWithoutMember.length}`);

// --- create missing members ---
let nextNo = 0;
if (alumniWithoutMember.length) {
  const { data: maxRow, error: eMax } = await supabase
    .from("members")
    .select("no")
    .order("no", { ascending: false })
    .limit(1)
    .single();
  if (eMax) throw eMax;
  nextNo = (maxRow.no ?? 0) + 1;
  console.log(`Starting no: ${nextNo}`);
}

const toCreate = alumniWithoutMember.map((a) => ({
  no: nextNo++,
  nama: a.nama,
  angkatan: a.angkatan,
  no_hp: "-",
  alumni_id: a.id,
  isi_form_dpt: "Sudah",
  sudah_dikontak: "Belum",
  masuk_grup: "Belum",
  registrasi_website_dpt: "Sudah",
  status_dpt: null,
  vote: "Belum",
  dukungan: null,
}));

// --- updates for already-existing members ---
const toUpdate = [];
for (const m of members) {
  const needForm = m.isi_form_dpt !== "Sudah";
  const needWeb = m.registrasi_website_dpt !== "Sudah";
  if (needForm || needWeb) {
    toUpdate.push({ id: m.id, nama: m.nama, needForm, needWeb });
  }
}
console.log(`\nCreates: ${toCreate.length}`);
console.log(`Updates: ${toUpdate.length}  (already-done: ${members.length - toUpdate.length})`);

if (toCreate.length) {
  console.log("\nSample creates:");
  toCreate.slice(0, 5).forEach((r) =>
    console.log(`  + no=${r.no} "${r.nama}" (alumni ${r.alumni_id})`)
  );
}
if (toUpdate.length) {
  console.log("\nSample updates:");
  toUpdate.slice(0, 5).forEach((u) =>
    console.log(`  ~ "${u.nama}" form=${u.needForm} web=${u.needWeb}`)
  );
}

if (!APPLY) {
  console.log("\n→ Re-run with --apply to write.");
  process.exit(0);
}

// --- APPLY ---
let created = 0, updated = 0, errCnt = 0;

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
    } else {
      created += data.length;
    }
  }
}

for (const u of toUpdate) {
  const patch = {};
  if (u.needForm) patch.isi_form_dpt = "Sudah";
  if (u.needWeb) patch.registrasi_website_dpt = "Sudah";
  const { error } = await supabase.from("members").update(patch).eq("id", u.id);
  if (error) { errCnt++; console.error(`  ❌ update "${u.nama}": ${error.message}`); }
  else updated++;
}

console.log(`\n→ Applied: created=${created}, updated=${updated}, errors=${errCnt}`);
