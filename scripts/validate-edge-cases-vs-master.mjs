/**
 * Validate the 6 edge-case alumni (NOSIS prefix doesn't match angkatan range)
 * against master-data-nosis.xlsx. If NOSIS not present in master, delete the
 * alumni row (and any linked member row).
 *
 * Usage:
 *   node --env-file=.env.local scripts/validate-edge-cases-vs-master.mjs [--apply]
 */
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import XLSX from "xlsx";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const APPLY = process.argv.includes("--apply");

const EDGE_CASES = [
  { ang: 22, nosis: "113369", nama: "Dompak Bastian Caesar Simangunsong" },
  { ang: 24, nosis: "130145", nama: "Evin Melliniya Angel Putri" },
  { ang: 24, nosis: "138610", nama: "Ikbar Bezkaturatea Daeng Maro" },
  { ang: 25, nosis: "141447", nama: "Siti Afianjani Rahmadianti" },
  { ang: 28, nosis: "178051", nama: "Muhammad Malik Aditya Kurniawan" },
  { ang: 30, nosis: "198992", nama: null },
  { ang: 30, nosis: "198993", nama: null },
  { ang: 30, nosis: "198994", nama: null },
  { ang: 30, nosis: "198995", nama: null },
  { ang: 30, nosis: "198996", nama: null },
  { ang: 30, nosis: "198997", nama: null },
  { ang: 30, nosis: "198998", nama: null },
  { ang: 30, nosis: "198999", nama: null },
];

function normNosis(s) {
  const digits = String(s ?? "").replace(/\D+/g, "");
  if (!digits) return "";
  return digits.length < 6 ? digits.padStart(6, "0") : digits;
}

console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"}\n`);

// Load master data
const wb = XLSX.read(readFileSync("master-data-nosis.xlsx"), { type: "buffer" });
const masterRows = XLSX.utils.sheet_to_json(wb.Sheets["Sheet1"], { defval: null, raw: false });
console.log(`Master rows: ${masterRows.length}`);

const masterByNosis = new Map();
for (const r of masterRows) {
  const n = normNosis(r.nosis_clean);
  if (n) masterByNosis.set(n, r);
}
console.log(`Master NOSIS unique: ${masterByNosis.size}\n`);

const toDelete = [];
const kept = [];

for (const ec of EDGE_CASES) {
  const master = masterByNosis.get(ec.nosis);
  if (master) {
    console.log(`  ✓ ${ec.nosis} (TN${ec.ang}) → found in master: "${master.name}" batch=${master.batch_id} valid=${master.nosis_valid}`);
    kept.push({ ...ec, master });
  } else {
    console.log(`  ✗ ${ec.nosis} (TN${ec.ang}) "${ec.nama ?? "?"}" → NOT IN MASTER → delete`);
    toDelete.push(ec);
  }
}

console.log(`\nSummary: ${kept.length} kept, ${toDelete.length} to delete\n`);

if (toDelete.length === 0) {
  console.log("Nothing to delete.");
  process.exit(0);
}

// Resolve alumni ids + linked members
for (const ec of toDelete) {
  const { data: alumni } = await supabase
    .from("alumni")
    .select("id, nosis, nama, angkatan")
    .eq("angkatan", ec.ang)
    .eq("nosis", ec.nosis)
    .maybeSingle();

  if (!alumni) {
    console.log(`  ⚠ TN${ec.ang} ${ec.nosis} — already not in DB`);
    continue;
  }

  const { data: members } = await supabase
    .from("members")
    .select("id, no, nama")
    .eq("alumni_id", alumni.id);

  console.log(`  TN${ec.ang} ${ec.nosis} "${alumni.nama}" alumni=${alumni.id} members=${members.length} [${members.map((m) => m.no).join(",")}]`);

  if (APPLY) {
    if (members.length > 0) {
      const { error: eM } = await supabase.from("members").delete().in("id", members.map((m) => m.id));
      if (eM) console.log(`    ❌ member delete: ${eM.message}`);
      else console.log(`    ✓ deleted ${members.length} member row(s)`);
    }
    const { error: eA } = await supabase.from("alumni").delete().eq("id", alumni.id);
    if (eA) console.log(`    ❌ alumni delete: ${eA.message}`);
    else console.log(`    ✓ deleted alumni ${alumni.id}`);
  }
}

if (!APPLY) console.log("\n→ Re-run with --apply to delete.");
