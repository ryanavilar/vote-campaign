/**
 * Set registrasi_website_dpt = "Sudah" and status_dpt = "Sudah" for the given
 * NOSIS list in a specific angkatan (from a "DAFTAR DPT TERVERIFIKASI" PDF).
 *
 * Usage:
 *   node --env-file=.env.local scripts/apply-web-dpt-by-list.mjs <angkatan> <nosis-file> [--apply]
 *   nosis-file = one NOSIS per line (comments with # ok)
 */
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const nonFlags = args.filter((a) => !a.startsWith("--"));
const angkatan = Number(nonFlags[0]);
const file = nonFlags[1];
if (!Number.isFinite(angkatan) || !file) {
  console.error("Usage: apply-web-dpt-by-list.mjs <angkatan> <nosis-file> [--apply]");
  process.exit(1);
}

const list = readFileSync(file, "utf8")
  .split("\n")
  .map((l) => l.split("#")[0].trim())
  .filter(Boolean);

console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"}`);
console.log(`TN${angkatan} | NOSIS count: ${list.length}\n`);

const { data: alumni, error: eA } = await supabase
  .from("alumni")
  .select("id, nosis, nama")
  .eq("angkatan", angkatan)
  .in("nosis", list);
if (eA) throw eA;

const unmatched = list.filter((n) => !alumni.find((a) => a.nosis === n));
console.log(`Alumni matched: ${alumni.length} / ${list.length}`);
if (unmatched.length) console.log(`Unmatched NOSIS: ${unmatched.join(", ")}`);

const { data: members } = await supabase
  .from("members")
  .select("id, nama, alumni_id, registrasi_website_dpt, status_dpt")
  .in("alumni_id", alumni.map((a) => a.id));

const byAlumniId = new Map(members.map((m) => [m.alumni_id, m]));

let toUpdate = 0, alreadyDone = 0, noMember = 0;
const updates = [];
for (const a of alumni) {
  const m = byAlumniId.get(a.id);
  if (!m) { noMember++; console.log(`  ⚠️ alumni tanpa member: ${a.nosis} ${a.nama}`); continue; }
  const needsWeb = m.registrasi_website_dpt !== "Sudah";
  const needsStatus = m.status_dpt !== "Sudah";
  if (!needsWeb && !needsStatus) { alreadyDone++; continue; }
  toUpdate++;
  updates.push({ m, a, needsWeb, needsStatus });
}

console.log(`\nTo update: ${toUpdate} member(s)`);
console.log(`  already done: ${alreadyDone}`);
console.log(`  alumni tanpa member row: ${noMember}`);

if (APPLY && updates.length > 0) {
  let ok = 0, err = 0;
  for (const u of updates) {
    const patch = {};
    if (u.needsWeb) patch.registrasi_website_dpt = "Sudah";
    if (u.needsStatus) patch.status_dpt = "Sudah";
    const { error } = await supabase.from("members").update(patch).eq("id", u.m.id);
    if (error) { err++; console.error(`  ❌ ${u.a.nosis} ${u.a.nama}: ${error.message}`); }
    else ok++;
  }
  console.log(`\n→ Applied: ${ok} updated, ${err} errors`);
}
if (!APPLY) console.log("\n→ Re-run with --apply to write.");
