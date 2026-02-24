/**
 * update-alumni-nosis.mjs
 *
 * Reads Master_Data_NOSIS.xlsx and updates alumni records with clean NOSIS values.
 * Matches by normalized name + angkatan. Inserts new records if not found.
 *
 * Usage:
 *   node --env-file=.env.local scripts/update-alumni-nosis.mjs [path-to-xlsx]
 *
 * Default path: ~/Downloads/Master_Data_NOSIS.xlsx
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import XLSX from "xlsx";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Missing environment variables. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.\n" +
    "   node --env-file=.env.local scripts/update-alumni-nosis.mjs"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function normalize(name) {
  return name.toLowerCase().trim().replace(/\s+/g, " ");
}

async function fetchAllAlumni(angkatan) {
  let all = [];
  let from = 0;
  const step = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("alumni")
      .select("id, nama, nosis, keterangan")
      .eq("angkatan", angkatan)
      .range(from, from + step - 1);
    if (error) {
      console.error(`  Error fetching angkatan ${angkatan}:`, error.message);
      break;
    }
    all = all.concat(data);
    if (data.length < step) break;
    from += step;
  }
  return all;
}

async function main() {
  const xlsxPath =
    process.argv[2] ||
    resolve(process.env.HOME, "Downloads", "Master_Data_NOSIS.xlsx");

  console.log(`Reading: ${xlsxPath}\n`);

  const buf = readFileSync(xlsxPath);
  const wb = XLSX.read(buf, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws);

  console.log(`Source records: ${rows.length}\n`);

  // Group by batch_id
  const byBatch = {};
  for (const row of rows) {
    const batch = row.batch_id;
    if (!byBatch[batch]) byBatch[batch] = [];
    byBatch[batch].push(row);
  }

  let totalUpdated = 0;
  let totalInserted = 0;
  let totalAlreadyOk = 0;
  let totalUnmatchedExcel = 0;
  let totalUnmatchedDb = 0;
  let totalErrors = 0;
  let totalDeceased = 0;

  const batches = Object.keys(byBatch).map(Number).sort((a, b) => a - b);

  for (const angkatan of batches) {
    const excelRows = byBatch[angkatan];
    const dbRows = await fetchAllAlumni(angkatan);

    // Build lookup map: normalized name → db record
    const dbMap = new Map();
    for (const db of dbRows) {
      dbMap.set(normalize(db.nama), db);
    }

    let updated = 0;
    let inserted = 0;
    let alreadyOk = 0;
    let errors = 0;
    let deceased = 0;
    const toInsert = [];

    // Deduplicate excel rows by normalized name (keep first)
    const seen = new Set();

    for (const row of excelRows) {
      const key = normalize(row.name);
      if (seen.has(key)) continue;
      seen.add(key);

      const dbRecord = dbMap.get(key);
      const nosis = String(row.nosis_clean);
      const isDeceased = !!row.decease_date;

      if (dbRecord) {
        // Matched — check if nosis needs update
        const updates = {};
        if (dbRecord.nosis !== nosis) {
          updates.nosis = nosis;
        }
        if (isDeceased && (!dbRecord.keterangan || !dbRecord.keterangan.includes("Almarhum"))) {
          updates.keterangan = dbRecord.keterangan
            ? `Almarhum. ${dbRecord.keterangan}`
            : "Almarhum";
          deceased++;
        }

        if (Object.keys(updates).length > 0) {
          const { error } = await supabase
            .from("alumni")
            .update(updates)
            .eq("id", dbRecord.id);
          if (error) {
            errors++;
          } else {
            updated++;
          }
        } else {
          alreadyOk++;
        }
      } else {
        // No match in DB — prepare for insert
        const newRecord = {
          nosis,
          nama: row.name.trim(),
          angkatan,
        };
        if (isDeceased) {
          newRecord.keterangan = "Almarhum";
          deceased++;
        }
        toInsert.push(newRecord);
      }
    }

    // Bulk insert new records
    if (toInsert.length > 0) {
      for (let i = 0; i < toInsert.length; i += 500) {
        const batch = toInsert.slice(i, i + 500);
        const { error } = await supabase.from("alumni").insert(batch);
        if (error) {
          // Fall back to individual inserts
          for (const item of batch) {
            const { error: itemErr } = await supabase.from("alumni").insert(item);
            if (itemErr) {
              errors++;
            } else {
              inserted++;
            }
          }
        } else {
          inserted += batch.length;
        }
      }
    }

    const unmatchedDb = dbRows.length - (updated + alreadyOk);

    console.log(
      `TN ${String(angkatan).padStart(2)}: ` +
      `${excelRows.length} source, ${dbRows.length} in DB | ` +
      `${updated} updated, ${alreadyOk} ok, ${inserted} new` +
      (unmatchedDb > 0 ? `, ${unmatchedDb} DB-only` : "") +
      (deceased > 0 ? `, ${deceased} deceased` : "") +
      (errors > 0 ? `, ${errors} errors` : "")
    );

    totalUpdated += updated;
    totalInserted += inserted;
    totalAlreadyOk += alreadyOk;
    totalUnmatchedDb += unmatchedDb;
    totalUnmatchedExcel += toInsert.length - inserted;
    totalErrors += errors;
    totalDeceased += deceased;
  }

  console.log(`\n${"=".repeat(70)}`);
  console.log(`TOTAL: ${totalUpdated} updated, ${totalAlreadyOk} already ok, ${totalInserted} new inserts`);
  console.log(`       ${totalUnmatchedDb} DB-only (no match in Excel), ${totalDeceased} deceased marked`);
  if (totalErrors > 0) console.log(`       ${totalErrors} errors`);
  console.log(`${"=".repeat(70)}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
