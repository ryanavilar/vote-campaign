/**
 * From the "DAFTAR DPT ANGKATAN XIII TERVERIFIKASI" PDF:
 * set registrasi_website_dpt = "Sudah" and status_dpt = "Sudah" for the
 * 24 listed members in TN13.
 */
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const APPLY = process.argv.includes("--apply");

const LIST = [
  "023330", "023399", "023467", "023507", "023270", "023336", "023477",
  "023409", "023452", "023486", "023387", "023454", "023352", "023422",
  "023491", "023492", "023324", "023394", "023494", "023495", "023496",
  "023429", "023430", "023563",
];

console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"}`);
console.log(`NOSIS dari PDF: ${LIST.length}\n`);

const { data: alumni, error: eA } = await supabase
  .from("alumni")
  .select("id, nosis, nama")
  .eq("angkatan", 13)
  .in("nosis", LIST);
if (eA) throw eA;

const unmatched = LIST.filter((n) => !alumni.find((a) => a.nosis === n));
console.log(`Alumni matched: ${alumni.length}`);
if (unmatched.length) console.log(`Unmatched: ${unmatched.join(", ")}`);

const { data: members } = await supabase
  .from("members")
  .select("id, nama, alumni_id, registrasi_website_dpt, status_dpt")
  .in("alumni_id", alumni.map((a) => a.id));

const byAlumniId = new Map(members.map((m) => [m.alumni_id, m]));

let toUpdate = 0;
let alreadyDone = 0;
let noMember = 0;
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
console.log(`  alumni tanpa member: ${noMember}`);

if (APPLY && updates.length > 0) {
  let ok = 0, err = 0;
  for (const u of updates) {
    const patch = {};
    if (u.needsWeb) patch.registrasi_website_dpt = "Sudah";
    if (u.needsStatus) patch.status_dpt = "Sudah";
    const { error } = await supabase.from("members").update(patch).eq("id", u.m.id);
    if (error) { err++; console.error(`  ❌ ${u.a.nosis} ${u.a.nama}: ${error.message}`); }
    else { ok++; }
  }
  console.log(`\n→ Applied: ${ok} updated, ${err} errors`);
}
if (!APPLY) console.log("\n→ Re-run with --apply to write.");
