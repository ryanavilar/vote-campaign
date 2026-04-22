/**
 * Fix NOSIS typos for TN23 & TN32 form submissions:
 * - TN23 125726 → 126726 (Regita Alya Savira)
 * - TN23 129722 → 126722 (Muhamad Lutfi Anugrah)
 * - TN32 2100008 → 2110008 (M. Diandra Adhi Makayasa)
 *
 * Set isi_form_dpt=Sudah on the REAL alumni's member row.
 */
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const APPLY = process.argv.includes("--apply");

const TYPOS = [
  { ang: 23, realNosis: "126726", name: "Regita Alya Savira" },
  { ang: 23, realNosis: "126722", name: "Muhamad Lutfi Anugrah" },
  { ang: 32, realNosis: "2110008", name: "M. Diandra Adhi Makayasa" },
];

console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"}\n`);

for (const t of TYPOS) {
  const { data: alumni } = await supabase
    .from("alumni").select("id, nosis, nama").eq("angkatan", t.ang).eq("nosis", t.realNosis).single();
  if (!alumni) { console.log(`  ❌ TN${t.ang} ${t.realNosis} alumni NOT FOUND`); continue; }

  const { data: member } = await supabase
    .from("members").select("id, nama, isi_form_dpt").eq("alumni_id", alumni.id).maybeSingle();
  if (!member) { console.log(`  ⚠ TN${t.ang} ${t.realNosis} ${alumni.nama} — alumni exists but no member row (auto-create will handle)`); continue; }

  if (member.isi_form_dpt === "Sudah") {
    console.log(`  ✓ TN${t.ang} ${t.realNosis} ${alumni.nama} already Sudah (skip)`);
    continue;
  }
  console.log(`  → TN${t.ang} ${t.realNosis} ${alumni.nama} member ${member.id}: Belum → Sudah`);
  if (APPLY) {
    const { error } = await supabase.from("members").update({ isi_form_dpt: "Sudah" }).eq("id", member.id);
    if (error) console.log(`    ❌ ${error.message}`);
    else console.log(`    ✓ updated`);
  }
}

if (!APPLY) console.log("\n→ Re-run with --apply to write.");
