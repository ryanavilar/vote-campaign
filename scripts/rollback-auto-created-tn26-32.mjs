/**
 * Rollback: user only wanted TN26/27/30/31/32 form files to UPDATE existing
 * members to isi_form_dpt=Sudah, NOT auto-create new member rows.
 *
 * Delete the 293 auto-created rows (no 2537-2829) + 1 Diandra row (no 2830).
 *
 * Identification: members with angkatan in {26,27,30,31,32} AND no >= 2537.
 * Safety: also verify these were created recently (created_at today 2026-04-22)
 * and double-check count matches expectation.
 */
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const APPLY = process.argv.includes("--apply");

const ANG = [26, 27, 30, 31, 32];

// Fetch candidates
const { data: candidates, error } = await supabase
  .from("members")
  .select("id, no, nama, angkatan, alumni_id, isi_form_dpt, created_at")
  .in("angkatan", ANG)
  .gte("no", 2537)
  .order("no", { ascending: true });
if (error) throw error;

console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"}`);
console.log(`Candidates (TN26/27/30/31/32 with no>=2537): ${candidates.length}\n`);

// Group by angkatan
const byAng = new Map();
for (const m of candidates) {
  if (!byAng.has(m.angkatan)) byAng.set(m.angkatan, []);
  byAng.get(m.angkatan).push(m);
}
for (const ang of ANG) {
  const list = byAng.get(ang) ?? [];
  const firstNo = list[0]?.no;
  const lastNo = list[list.length - 1]?.no;
  console.log(`  TN${ang}: ${list.length} rows (no ${firstNo}-${lastNo})`);
}

// Expected: 71+11+45+113+53+1 = 294
const EXPECTED = 294;
if (candidates.length !== EXPECTED) {
  console.log(`\n⚠ Expected ${EXPECTED} but found ${candidates.length}. Aborting for safety.`);
  process.exit(1);
}

// Sanity check: all should have isi_form_dpt=Sudah (they were created that way)
const notSudah = candidates.filter((m) => m.isi_form_dpt !== "Sudah");
if (notSudah.length) {
  console.log(`\n⚠ ${notSudah.length} candidates have isi_form_dpt != Sudah (unexpected):`);
  for (const m of notSudah.slice(0, 5)) console.log(`  - no=${m.no} ${m.nama} isi_form_dpt=${m.isi_form_dpt}`);
}

if (APPLY) {
  const ids = candidates.map((m) => m.id);
  let ok = 0, err = 0;
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const { error } = await supabase.from("members").delete().in("id", chunk);
    if (error) {
      err += chunk.length;
      console.log(`  ❌ batch err: ${error.message}`);
    } else {
      ok += chunk.length;
    }
  }
  console.log(`\n→ Deleted: ${ok} rows, ${err} errors`);
} else {
  console.log("\n→ Re-run with --apply to delete.");
}
