/**
 * 1. Delete 3 ghost alumni rows (NOSIS not in Excel, 0 linked members)
 * 2. Drop unique index idx_alumni_nama_angkatan (Excel has legit dup names)
 *
 * Usage:
 *   node --env-file=.env.local scripts/fix-alumni-constraint-and-ghosts.mjs --apply
 */
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const APPLY = process.argv.includes("--apply");

const GHOSTS = [
  { id: "ce78382c-1cb9-493b-b2ec-01e23defc1cf", label: "TN1 908383 Hendra Wirawan" },
  { id: "42b718a6-8d34-45bf-969c-3667c24c26cf", label: "TN13 023406 Dwiandi Susilo" },
  { id: "c1f1629d-6a37-4ac1-9ebc-24454fbcec1f", label: "TN28 174186 Rimadhina Noviana Mega" },
];

console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"}\n`);

// Verify ghosts still have 0 members
for (const g of GHOSTS) {
  const { count } = await supabase.from("members").select("id", { count: "exact", head: true }).eq("alumni_id", g.id);
  if (count > 0) {
    console.error(`❌ ${g.label} id=${g.id} has ${count} linked members — aborting`);
    process.exit(1);
  }
  console.log(`✓ ${g.label} safe to delete (0 members)`);
}

if (APPLY) {
  console.log("\nDeleting ghosts...");
  for (const g of GHOSTS) {
    const { error } = await supabase.from("alumni").delete().eq("id", g.id);
    if (error) console.error(`  ❌ ${g.label}: ${error.message}`);
    else console.log(`  ✓ deleted ${g.label}`);
  }

  console.log("\nDropping unique index idx_alumni_nama_angkatan...");
  const { error: dropErr } = await supabase.rpc("exec_sql", {
    sql: "DROP INDEX IF EXISTS idx_alumni_nama_angkatan; CREATE INDEX IF NOT EXISTS idx_alumni_nama_angkatan_plain ON alumni(LOWER(TRIM(nama)), angkatan);",
  });
  if (dropErr) console.error(`  ❌ ${dropErr.message}`);
  else console.log(`  ✓ unique index dropped; replaced with non-unique index`);
} else {
  console.log("\n→ Re-run with --apply to execute.");
}
