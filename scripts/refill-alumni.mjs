#!/usr/bin/env node
/**
 * Refill alumni table from Master_Data_NOSIS.xlsx
 * 1. Unlink all members (set alumni_id = null)
 * 2. Drop unique constraint on nama+angkatan (allows duplicate names with different nosis)
 * 3. Delete all alumni records
 * 4. Insert fresh data from Excel
 * 5. Re-link members by matching normalized name + angkatan
 */

import { createClient } from "@supabase/supabase-js";
import XLSX from "xlsx";
import { readFileSync } from "fs";

// Load .env.local manually
const envContent = readFileSync(".env.local", "utf8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx > 0) {
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    process.env[key] = val;
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const EXCEL_PATH = "/Users/ryanavilar/Downloads/Master_Data_NOSIS.xlsx";

function normalizeName(name) {
  return (name || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9 ]/g, "");
}

function excelDateToISO(serial) {
  if (!serial) return null;
  if (typeof serial === "string") {
    const parts = serial.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (parts) {
      return `${parts[3]}-${parts[2]}-${parts[1]}`;
    }
    return null;
  }
  // Excel serial date
  const utcDays = Math.floor(serial - 25569);
  const d = new Date(utcDays * 86400 * 1000);
  return d.toISOString().split("T")[0];
}

async function main() {
  console.log("=== Refill Alumni from NOSIS Master Data ===\n");

  // Read Excel
  const wb = XLSX.readFile(EXCEL_PATH);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws);
  console.log(`📊 Excel: ${rows.length} records\n`);

  // Step 1: Unlink all members
  console.log("Step 1: Unlinking all members from alumni...");
  const { error: unlinkError } = await supabase
    .from("members")
    .update({ alumni_id: null })
    .not("alumni_id", "is", null);
  if (unlinkError) {
    console.error("  ❌ Error unlinking:", unlinkError.message);
    process.exit(1);
  }
  console.log("  ✅ Unlinked all members\n");

  // Step 2: Drop unique constraint on nama+angkatan
  console.log("Step 2: Dropping unique constraint idx_alumni_nama_angkatan...");
  const { error: dropError } = await supabase.rpc("exec_sql", {
    sql: "DROP INDEX IF EXISTS idx_alumni_nama_angkatan;",
  });
  if (dropError) {
    console.log("  ⚠️  Could not drop via RPC:", dropError.message);
    console.log("  Trying alternate approach - inserting one by one for dupes...\n");
  } else {
    console.log("  ✅ Constraint dropped\n");
  }

  // Step 3: Delete all alumni
  console.log("Step 3: Deleting all existing alumni...");
  const { error: deleteError } = await supabase
    .from("alumni")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (deleteError) {
    console.error("  ❌ Error deleting:", deleteError.message);
    process.exit(1);
  }
  const { count: afterDeleteCount } = await supabase
    .from("alumni")
    .select("*", { count: "exact", head: true });
  console.log(`  ✅ Deleted. Remaining: ${afterDeleteCount}\n`);

  // Step 4: Insert fresh alumni data
  console.log("Step 4: Inserting fresh alumni data...");

  // Deduplicate by nosis_clean (keep first occurrence)
  const seenNosis = new Set();
  const uniqueRows = [];
  for (const row of rows) {
    const nosis = String(row.nosis_clean || "").trim();
    if (!nosis || seenNosis.has(nosis)) continue;
    seenNosis.add(nosis);
    uniqueRows.push(row);
  }
  console.log(`  Unique records (by nosis): ${uniqueRows.length}`);

  // Find duplicate name+angkatan combos and suffix them
  const nameAngkatanCount = {};
  for (const row of uniqueRows) {
    const name = (row.name || "").trim().toLowerCase();
    const key = `${name}|${row.batch_id}`;
    nameAngkatanCount[key] = (nameAngkatanCount[key] || 0) + 1;
  }
  const dupeNames = Object.entries(nameAngkatanCount)
    .filter(([, c]) => c > 1)
    .map(([k]) => k);
  console.log(`  Duplicate name+angkatan combos: ${dupeNames.length}`);
  dupeNames.forEach((k) => console.log(`    - ${k}`));

  // Prepare alumni records - for duplicates, append nosis to make name unique
  const nameAngkatanSeen = {};
  const alumniRecords = uniqueRows.map((row) => {
    const deceaseDate = excelDateToISO(row.decease_date);
    let keterangan = null;
    if (deceaseDate) {
      keterangan = `Almarhum. RIP ${deceaseDate}`;
    }

    // Title case the name
    let name = (row.name || "")
      .trim()
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");

    // Handle duplicate name+angkatan by appending (NOSIS) suffix
    const normKey = `${name.toLowerCase()}|${row.batch_id}`;
    if (nameAngkatanCount[normKey] > 1) {
      if (nameAngkatanSeen[normKey]) {
        // Second+ occurrence, append nosis
        name = `${name} (${row.nosis_clean})`;
      }
      nameAngkatanSeen[normKey] = true;
    }

    return {
      nosis: String(row.nosis_clean).trim(),
      nama: name,
      angkatan: row.batch_id,
      keterangan,
    };
  });

  // Insert in batches of 500
  let inserted = 0;
  let insertErrors = 0;
  const failedRecords = [];
  const BATCH_SIZE = 500;
  for (let i = 0; i < alumniRecords.length; i += BATCH_SIZE) {
    const batch = alumniRecords.slice(i, i + BATCH_SIZE);
    const { error: insertError, data: insertData } = await supabase
      .from("alumni")
      .insert(batch)
      .select("id");
    if (insertError) {
      console.error(
        `  ❌ Batch ${Math.floor(i / BATCH_SIZE) + 1} error: ${insertError.message}`
      );
      // Try inserting one by one for this batch
      console.log("    Falling back to row-by-row insert...");
      for (const record of batch) {
        const { error: singleError, data: singleData } = await supabase
          .from("alumni")
          .insert(record)
          .select("id");
        if (singleError) {
          console.error(`    ❌ Failed: ${record.nama} (${record.angkatan}): ${singleError.message}`);
          failedRecords.push({ ...record, error: singleError.message });
          insertErrors++;
        } else {
          inserted++;
        }
      }
    } else {
      inserted += (insertData || []).length;
    }
  }
  console.log(`  ✅ Inserted: ${inserted}, Errors: ${insertErrors}`);
  if (failedRecords.length > 0) {
    console.log("  Failed records:");
    failedRecords.forEach((r) => console.log(`    - ${r.nama} (Angkatan ${r.angkatan}): ${r.error}`));
  }
  console.log();

  // Verify insertion
  const { count: finalAlumniCount } = await supabase
    .from("alumni")
    .select("*", { count: "exact", head: true });
  console.log(`  📊 Total alumni in DB: ${finalAlumniCount}\n`);

  // Step 5: Re-link members to alumni by name + angkatan
  console.log("Step 5: Re-linking members to alumni...");

  // Fetch all alumni
  const allAlumni = [];
  let alumniOffset = 0;
  while (true) {
    const { data: batch } = await supabase
      .from("alumni")
      .select("id, nama, angkatan, nosis")
      .range(alumniOffset, alumniOffset + 999);
    if (!batch || batch.length === 0) break;
    allAlumni.push(...batch);
    alumniOffset += batch.length;
    if (batch.length < 1000) break;
  }
  console.log(`  Fetched ${allAlumni.length} alumni for matching`);

  // Build lookup: normalized name + angkatan → alumni_id
  const alumniMap = new Map();
  for (const a of allAlumni) {
    const key = `${normalizeName(a.nama)}|${a.angkatan}`;
    if (!alumniMap.has(key)) {
      alumniMap.set(key, a.id);
    }
  }

  // Also build nosis → alumni_id lookup
  const nosisMap = new Map();
  for (const a of allAlumni) {
    if (a.nosis) {
      nosisMap.set(a.nosis, a.id);
    }
  }

  // Fetch all members (no nosis column in members table)
  const allMembers = [];
  let memberOffset = 0;
  while (true) {
    const { data: batch } = await supabase
      .from("members")
      .select("id, nama, angkatan")
      .range(memberOffset, memberOffset + 999);
    if (!batch || batch.length === 0) break;
    allMembers.push(...batch);
    memberOffset += batch.length;
    if (batch.length < 1000) break;
  }
  console.log(`  Fetched ${allMembers.length} members for matching`);

  let linked = 0;
  let notFound = 0;
  for (const m of allMembers) {
    // Try name + angkatan match
    const key = `${normalizeName(m.nama)}|${m.angkatan}`;
    const alumniId = alumniMap.get(key);

    if (alumniId) {
      const { error: linkError } = await supabase
        .from("members")
        .update({ alumni_id: alumniId })
        .eq("id", m.id);
      if (!linkError) linked++;
    } else {
      notFound++;
    }
  }

  console.log(`  ✅ Linked: ${linked}`);
  console.log(`  ⚠️  Not matched: ${notFound}\n`);

  // Final summary
  const { count: finalLinked } = await supabase
    .from("members")
    .select("*", { count: "exact", head: true })
    .not("alumni_id", "is", null);

  console.log("=== FINAL SUMMARY ===");
  console.log(`Alumni in DB: ${finalAlumniCount}`);
  console.log(`Members linked: ${finalLinked}`);
  console.log(`Deceased (Almarhum): ${alumniRecords.filter((r) => r.keterangan).length}`);
  console.log("=====================");
}

main().catch(console.error);
