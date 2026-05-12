/**
 * One-shot: 2026-04-24 data update from user
 *
 *  TN18 form DPT (from xlsx, NOSIS-based): set isi_form_dpt="Sudah", create member if missing
 *  TN24 form DPT (from xlsx, name-based, valid only): set isi_form_dpt="Sudah", create member if missing
 *  TN18 web DPT  (handled separately by apply-web-dpt-by-list.mjs 18 scripts/_tn18-web-dpt.txt)
 *
 * Usage:
 *   node --env-file=.env.local scripts/apply-2026-04-24-update.mjs [--apply]
 */
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const APPLY = process.argv.includes("--apply");

function normName(s) {
  return String(s ?? "")
    .toUpperCase()
    .normalize("NFKD")
    .replace(/[‘’'`"]/g, "")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"}\n`);

// ── Source data ──────────────────────────────────────────
const tn18Nosis = readFileSync("/tmp/tn18-form-nosis.txt", "utf8")
  .split("\n")
  .map((l) => l.trim())
  .filter(Boolean);
const tn24Names = JSON.parse(readFileSync("/tmp/tn24-form-names.json", "utf8"));
console.log(`Input TN18 NOSIS: ${tn18Nosis.length}`);
console.log(`Input TN24 names (valid): ${tn24Names.length}\n`);

// ── Resolve alumni ───────────────────────────────────────
async function resolveTN18() {
  const { data: alumni } = await supabase
    .from("alumni")
    .select("id, nosis, nama, angkatan")
    .eq("angkatan", 18);
  const byNosis = new Map(alumni.map((a) => [String(a.nosis), a]));
  const matched = [];
  const unmatched = [];
  for (const n of tn18Nosis) {
    const a = byNosis.get(n);
    if (a) matched.push(a);
    else unmatched.push(n);
  }
  return { matched, unmatched };
}

async function resolveTN24() {
  const { data: alumni } = await supabase
    .from("alumni")
    .select("id, nosis, nama, angkatan")
    .eq("angkatan", 24);
  const byNorm = new Map();
  for (const a of alumni) {
    const k = normName(a.nama);
    if (!byNorm.has(k)) byNorm.set(k, []);
    byNorm.get(k).push(a);
  }
  const matched = [];
  const ambiguous = [];
  const unmatched = [];
  for (const name of tn24Names) {
    const k = normName(name);
    if (!k) continue;
    const hits = byNorm.get(k);
    if (!hits || hits.length === 0) unmatched.push(name);
    else if (hits.length > 1) ambiguous.push({ name, hits });
    else matched.push(hits[0]);
  }
  return { matched, ambiguous, unmatched };
}

const tn18 = await resolveTN18();
const tn24 = await resolveTN24();
console.log(`TN18 alumni matched: ${tn18.matched.length}/${tn18Nosis.length}`);
if (tn18.unmatched.length) console.log(`  unmatched NOSIS: ${tn18.unmatched.join(", ")}`);
console.log(`TN24 alumni matched: ${tn24.matched.length}/${tn24Names.length}`);
if (tn24.ambiguous.length) {
  console.log("  ambiguous names:");
  tn24.ambiguous.forEach((a) => console.log(`    - "${a.name}" → ${a.hits.map((h) => h.nosis).join(", ")}`));
}
if (tn24.unmatched.length) {
  console.log("  unmatched names:");
  tn24.unmatched.forEach((n) => console.log(`    - "${n}"`));
}

// ── Check existing members ───────────────────────────────
async function fetchMembers(alumniList) {
  if (alumniList.length === 0) return new Map();
  const ids = alumniList.map((a) => a.id);
  const { data: members } = await supabase
    .from("members")
    .select("id, alumni_id, nama, isi_form_dpt")
    .in("alumni_id", ids);
  return new Map(members.map((m) => [m.alumni_id, m]));
}

const allMatched = [...tn18.matched, ...tn24.matched];
const memberByAlumni = await fetchMembers(allMatched);

function plan(matched, label) {
  const toFlip = [];
  const alreadySudah = [];
  const needCreate = [];
  for (const a of matched) {
    const m = memberByAlumni.get(a.id);
    if (!m) { needCreate.push(a); continue; }
    if (m.isi_form_dpt === "Sudah") alreadySudah.push(m);
    else toFlip.push(m);
  }
  console.log(`\n${label}: flip=${toFlip.length}, already Sudah=${alreadySudah.length}, create=${needCreate.length}`);
  if (needCreate.length) {
    needCreate.slice(0, 15).forEach((a) => console.log(`  + ${a.nosis} ${a.nama}`));
    if (needCreate.length > 15) console.log(`  ... +${needCreate.length - 15} more`);
  }
  return { toFlip, needCreate };
}
const p18 = plan(tn18.matched, "TN18 form DPT plan");
const p24 = plan(tn24.matched, "TN24 form DPT plan");

if (!APPLY) {
  console.log("\n→ Re-run with --apply to write.");
  process.exit(0);
}

// ── APPLY ────────────────────────────────────────────────
const needCreateRaw = [...p18.needCreate, ...p24.needCreate];
const seenAlumni = new Set();
const needCreateAll = needCreateRaw.filter((a) => {
  if (seenAlumni.has(a.id)) return false;
  seenAlumni.add(a.id);
  return true;
});
const toFlipAll = [...p18.toFlip, ...p24.toFlip];
console.log(`\nAfter dedup: create=${needCreateAll.length} (from ${needCreateRaw.length}), flip=${toFlipAll.length}`);

let created = 0, flipped = 0, errs = 0;

if (needCreateAll.length) {
  const { data: maxRow } = await supabase
    .from("members")
    .select("no").order("no", { ascending: false }).limit(1).single();
  let nextNo = (maxRow.no ?? 0) + 1;
  const rowsToInsert = needCreateAll.map((a) => ({
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
  const { data, error } = await supabase.from("members").insert(rowsToInsert).select("id");
  if (error) console.error("create error:", error.message);
  else created = data.length;
}

for (const m of toFlipAll) {
  const { error } = await supabase.from("members").update({ isi_form_dpt: "Sudah" }).eq("id", m.id);
  if (error) { errs++; console.error(`  ❌ flip "${m.nama}": ${error.message}`); }
  else flipped++;
}

console.log(`\n→ Applied: created=${created}, flipped=${flipped}, errors=${errs}`);
