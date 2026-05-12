/**
 * One-shot: 2026-04-24 part 2
 *
 *   TN24 form DPT (new xlsx with NOSIS): isi_form_dpt=Sudah, create member if missing
 *   TN23 form DPT (xlsx with NOSIS + phone): isi_form_dpt=Sudah, create member if missing
 *   (TN23 web DPT handled by apply-web-dpt-by-list.mjs 23 scripts/_tn23-web-dpt.txt)
 */
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const APPLY = process.argv.includes("--apply");

const tn24Nosis = readFileSync("/tmp/tn24-form-nosis.txt", "utf8")
  .split("\n").map((l) => l.trim()).filter(Boolean);
const tn23Records = JSON.parse(readFileSync("/tmp/tn23-form-records.json", "utf8"));

console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"}`);
console.log(`TN24 NOSIS: ${tn24Nosis.length}`);
console.log(`TN23 records: ${tn23Records.length}\n`);

async function processAng(ang, sourceRecords, label) {
  const { data: alumni } = await supabase
    .from("alumni").select("id, nosis, nama, angkatan").eq("angkatan", ang);
  const byNosis = new Map(alumni.map((a) => [String(a.nosis), a]));
  const matched = [];
  const unmatched = [];
  for (const rec of sourceRecords) {
    const nosis = typeof rec === "string" ? rec : rec.nosis;
    const a = byNosis.get(String(nosis));
    if (a) matched.push({ alumni: a, phone: typeof rec === "object" ? rec.phone : null });
    else unmatched.push(nosis);
  }
  console.log(`${label}: matched=${matched.length}/${sourceRecords.length}, unmatched=${unmatched.length}`);
  if (unmatched.length) console.log(`  unmatched NOSIS: ${unmatched.join(", ")}`);

  // Dedup matched by alumni id
  const seen = new Set();
  const uniqueMatched = matched.filter((m) => {
    if (seen.has(m.alumni.id)) return false;
    seen.add(m.alumni.id);
    return true;
  });

  const ids = uniqueMatched.map((m) => m.alumni.id);
  const { data: members } = await supabase
    .from("members").select("id, alumni_id, nama, isi_form_dpt, no_hp").in("alumni_id", ids);
  const byAlumni = new Map(members.map((m) => [m.alumni_id, m]));

  const toFlip = [];
  const alreadySudah = [];
  const needCreate = [];
  for (const m of uniqueMatched) {
    const existing = byAlumni.get(m.alumni.id);
    if (!existing) { needCreate.push(m); continue; }
    if (existing.isi_form_dpt === "Sudah") alreadySudah.push(existing);
    else toFlip.push(existing);
  }
  console.log(`  flip=${toFlip.length}, already Sudah=${alreadySudah.length}, create=${needCreate.length}`);
  return { toFlip, needCreate };
}

const p24 = await processAng(24, tn24Nosis, "TN24");
const p23 = await processAng(23, tn23Records, "TN23");

if (!APPLY) {
  console.log("\n→ Re-run with --apply to write.");
  process.exit(0);
}

// APPLY
const needCreateAll = [...p24.needCreate, ...p23.needCreate];
const toFlipAll = [...p24.toFlip, ...p23.toFlip];

let created = 0, flipped = 0, errs = 0;
if (needCreateAll.length) {
  const { data: maxRow } = await supabase
    .from("members").select("no").order("no", { ascending: false }).limit(1).single();
  let nextNo = (maxRow.no ?? 0) + 1;
  const rows = needCreateAll.map((m) => ({
    no: nextNo++,
    nama: m.alumni.nama,
    angkatan: m.alumni.angkatan,
    no_hp: m.phone || "-",
    alumni_id: m.alumni.id,
    isi_form_dpt: "Sudah",
    sudah_dikontak: "Belum",
    masuk_grup: "Belum",
    registrasi_website_dpt: "Belum",
    status_dpt: null,
    vote: "Belum",
    dukungan: null,
  }));
  const { data, error } = await supabase.from("members").insert(rows).select("id");
  if (error) console.error("create error:", error.message);
  else created = data.length;
}
for (const m of toFlipAll) {
  const { error } = await supabase.from("members").update({ isi_form_dpt: "Sudah" }).eq("id", m.id);
  if (error) { errs++; console.error(`  ❌ "${m.nama}": ${error.message}`); }
  else flipped++;
}
console.log(`\n→ Applied: created=${created}, flipped=${flipped}, errors=${errs}`);
