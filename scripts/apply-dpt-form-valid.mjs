/**
 * Apply isi_form_dpt = "Sudah" for members whose NOSIS appears (valid-only)
 * in the TN13 and TN15 verification Excel files.
 *
 * Input:
 *   tn13-dpt.xlsx  sheet "Valid"     columns: Nosis, Nama
 *   tn15-dpt.xlsx  sheet "COPY FORM" columns: NOSIS, Nama Lengkap, Validate=Valid
 *
 * Usage:
 *   node --env-file=.env.local scripts/apply-dpt-form-valid.mjs          # dry-run
 *   node --env-file=.env.local scripts/apply-dpt-form-valid.mjs --apply  # write
 */
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import XLSX from "xlsx";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const APPLY = process.argv.includes("--apply");

const SOURCES = [
  {
    file: "tn13-dpt.xlsx",
    ang: 13,
    sheet: "Valid",
    nosisCol: "Nosis",
    nameCol: "Nama",
    filter: () => true,
  },
  {
    file: "tn15-dpt.xlsx",
    ang: 15,
    sheet: "COPY FORM",
    nosisCol: "NOSIS",
    nameCol: "Nama Lengkap",
    filter: (r) => String(r.Validate || "").trim().toLowerCase() === "valid",
  },
  {
    file: "tn20-formdpt.xlsx",
    ang: 20,
    sheet: "Form responses 1",
    nosisCol: "NOSIS (penulisan tanpa spasi e.g: 999999)",
    nameCol: "Nama Lengkap",
    filter: (r) => String(r.Validate || "").trim().toLowerCase() === "valid",
  },
];

function normNosis(s) {
  return String(s ?? "").replace(/\s+/g, "").trim();
}

async function processSource(src) {
  console.log(`\n=== TN${src.ang} (${src.file}) ===`);
  const wb = XLSX.read(readFileSync(src.file), { type: "buffer" });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[src.sheet], { defval: null, raw: false });
  const valid = rows.filter(src.filter);
  console.log(`Rows: ${rows.length} | Valid: ${valid.length}`);

  const nosisList = [...new Set(valid.map((r) => normNosis(r[src.nosisCol])).filter(Boolean))];

  // Fetch matching alumni
  const { data: alumni, error: eA } = await supabase
    .from("alumni")
    .select("id, nosis, nama, angkatan")
    .eq("angkatan", src.ang)
    .in("nosis", nosisList);
  if (eA) throw eA;

  const alumniByNosis = new Map(alumni.map((a) => [a.nosis, a]));
  const unmatchedNosis = nosisList.filter((n) => !alumniByNosis.has(n));
  const alumniIds = alumni.map((a) => a.id);

  // Fetch linked members
  const { data: members, error: eM } = await supabase
    .from("members")
    .select("id, nama, no_hp, alumni_id, isi_form_dpt")
    .in("alumni_id", alumniIds);
  if (eM) throw eM;

  const membersByAlumniId = new Map();
  for (const m of members) membersByAlumniId.set(m.alumni_id, m);

  let toUpdate = 0;
  let alreadySudah = 0;
  let alumniNoMember = 0;
  const examples = [];

  for (const a of alumni) {
    const m = membersByAlumniId.get(a.id);
    if (!m) {
      alumniNoMember++;
      continue;
    }
    if (m.isi_form_dpt === "Sudah") {
      alreadySudah++;
      continue;
    }
    toUpdate++;
    if (examples.length < 5) examples.push(`  ${a.nosis} ${a.nama} (member id=${m.id})`);
  }

  console.log(`Alumni matched:    ${alumni.length} / ${nosisList.length}`);
  console.log(`  ${alumniNoMember} alumni tanpa member row`);
  console.log(`  ${alreadySudah} member sudah isi_form_dpt=Sudah`);
  console.log(`  ${toUpdate} member akan di-set Sudah`);
  if (unmatchedNosis.length > 0) {
    console.log(`Unmatched NOSIS (${unmatchedNosis.length}): ${unmatchedNosis.slice(0, 10).join(", ")}${unmatchedNosis.length > 10 ? " ..." : ""}`);
  }
  if (examples.length) {
    console.log("Sample:");
    examples.forEach((e) => console.log(e));
  }

  if (APPLY && toUpdate > 0) {
    const memberIds = [];
    for (const a of alumni) {
      const m = membersByAlumniId.get(a.id);
      if (m && m.isi_form_dpt !== "Sudah") memberIds.push(m.id);
    }
    let ok = 0;
    let err = 0;
    for (let i = 0; i < memberIds.length; i += 200) {
      const chunk = memberIds.slice(i, i + 200);
      const { error } = await supabase
        .from("members")
        .update({ isi_form_dpt: "Sudah" })
        .in("id", chunk);
      if (error) {
        err += chunk.length;
        console.error("  ❌", error.message);
      } else {
        ok += chunk.length;
      }
    }
    console.log(`→ Applied: ${ok} updated, ${err} errors`);
    return { matched: alumni.length, nosisCount: nosisList.length, toUpdate, alreadySudah, unmatched: unmatchedNosis.length, updated: ok, errors: err };
  }

  return { matched: alumni.length, nosisCount: nosisList.length, toUpdate, alreadySudah, unmatched: unmatchedNosis.length, updated: 0, errors: 0 };
}

console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"}`);
const results = [];
for (const src of SOURCES) {
  results.push({ ang: src.ang, ...(await processSource(src)) });
}

console.log(`\n${"=".repeat(60)}`);
console.log("SUMMARY");
for (const r of results) {
  console.log(
    `TN${r.ang}: ${r.nosisCount} valid NOSIS → ${r.matched} alumni matched → ${r.toUpdate} to set Sudah (${r.alreadySudah} already, ${r.unmatched} unmatched NOSIS)` +
      (APPLY ? ` | applied=${r.updated} err=${r.errors}` : "")
  );
}
if (!APPLY) console.log("\n→ Re-run with --apply to write.");
