/**
 * seed-alumni.mjs
 *
 * Reads "Daftar Nama Alumni.xlsx" and upserts all alumni records into Supabase.
 *
 * Usage:
 *   node scripts/seed-alumni.mjs [path-to-xlsx]
 *
 * Default path: ~/Downloads/Daftar Nama Alumni.xlsx
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import XLSX from "xlsx";

// ---------------------------------------------------------------------------
// Config — reads from environment variables (set in .env.local or export them)
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "❌ Missing environment variables. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.\n" +
    "   You can load them from .env.local:\n" +
    "   node --env-file=.env.local scripts/seed-alumni.mjs"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Sheet name → angkatan mapping
const SHEET_MAP = {};
for (let i = 1; i <= 32; i++) SHEET_MAP[`TN ${i}`] = i;
SHEET_MAP["KELAS XII"] = 33;
SHEET_MAP["KELAS XI"] = 34;
SHEET_MAP["KELAS X"] = 35;

// ---------------------------------------------------------------------------
// Excel parsing
// ---------------------------------------------------------------------------

function parseSheet(ws, angkatan) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  if (rows.length < 2) return [];

  // Find header row (first non-empty row)
  const header = rows[0] || [];
  const headerLower = header.map((h) =>
    h ? String(h).toLowerCase().trim() : ""
  );

  // Detect column indices
  const noIdx = headerLower.indexOf("no.");
  const nosisIdx = headerLower.indexOf("nosis");
  const namaIdx = headerLower.indexOf("nama");

  // Detect kelanjutan studi column
  const kelanjutanIdx = headerLower.findIndex((h) =>
    h.includes("kelanjutan")
  );

  // Detect program studi — could be "program studi", "fakultas", or "jurusan"
  const programIdx = headerLower.findIndex(
    (h) => h.includes("program studi") || h === "fakultas"
  );

  // Keterangan column
  const keteranganIdx = headerLower.findIndex((h) => h.includes("keterangan"));

  if (namaIdx === -1) {
    console.warn(`  ⚠ Sheet has no NAMA column, skipping`);
    return [];
  }

  const alumni = [];

  // Data rows start after header (row index 1+)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const nama = row[namaIdx];
    if (!nama || !String(nama).trim()) continue;

    // Convert NOSIS to string, preserving formats like "00.2547"
    let nosis = null;
    if (nosisIdx !== -1 && row[nosisIdx] != null) {
      nosis = String(row[nosisIdx]).trim();
      if (nosis === "" || nosis === "undefined" || nosis === "null") {
        nosis = null;
      }
    }

    const kelanjutan =
      kelanjutanIdx !== -1 && row[kelanjutanIdx]
        ? String(row[kelanjutanIdx]).trim() || null
        : null;

    const program =
      programIdx !== -1 && row[programIdx]
        ? String(row[programIdx]).trim() || null
        : null;

    const keterangan =
      keteranganIdx !== -1 && row[keteranganIdx]
        ? String(row[keteranganIdx]).trim() || null
        : null;

    alumni.push({
      nosis,
      nama: String(nama).trim(),
      angkatan,
      kelanjutan_studi: kelanjutan,
      program_studi: program,
      keterangan,
    });
  }

  return alumni;
}

// ---------------------------------------------------------------------------
// Upsert logic (same as the old import API)
// ---------------------------------------------------------------------------

async function upsertAlumni(alumniList, angkatan) {
  // Fetch existing alumni for this angkatan
  const { data: existing } = await supabase
    .from("alumni")
    .select("id, nama")
    .eq("angkatan", angkatan);

  const existingMap = new Map();
  (existing || []).forEach((a) => {
    existingMap.set(a.nama.toLowerCase().trim(), a.id);
  });

  const toInsert = [];
  const toUpdate = [];

  for (const alumni of alumniList) {
    const key = alumni.nama.toLowerCase().trim();
    const existingId = existingMap.get(key);

    if (existingId) {
      toUpdate.push({
        id: existingId,
        data: {
          nosis: alumni.nosis,
          kelanjutan_studi: alumni.kelanjutan_studi,
          program_studi: alumni.program_studi,
          keterangan: alumni.keterangan,
        },
      });
    } else {
      toInsert.push(alumni);
    }
  }

  // Deduplicate within the insert list (keep first occurrence)
  const seenKeys = new Set();
  const deduped = [];
  for (const alumni of toInsert) {
    const key = alumni.nama.toLowerCase().trim();
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      deduped.push(alumni);
    }
  }
  if (deduped.length < toInsert.length) {
    console.log(`    Deduped: ${toInsert.length - deduped.length} duplicate names within sheet`);
  }

  let inserted = 0;
  let updated = 0;
  let errors = 0;

  // Bulk insert in batches of 500
  for (let i = 0; i < deduped.length; i += 500) {
    const batch = deduped.slice(i, i + 500);
    const { error } = await supabase.from("alumni").insert(batch);
    if (error) {
      // Batch failed — fall back to individual inserts
      console.log(`    Batch insert failed, falling back to individual inserts...`);
      for (const item of batch) {
        const { error: itemError } = await supabase.from("alumni").insert(item);
        if (itemError) {
          errors++;
        } else {
          inserted++;
        }
      }
    } else {
      inserted += batch.length;
    }
  }

  // Update existing
  for (const item of toUpdate) {
    const { error } = await supabase
      .from("alumni")
      .update(item.data)
      .eq("id", item.id);
    if (error) {
      errors++;
    } else {
      updated++;
    }
  }

  return { inserted, updated, errors };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const xlsxPath =
    process.argv[2] ||
    resolve(process.env.HOME, "Downloads", "Daftar Nama Alumni.xlsx");

  console.log(`📖 Reading Excel file: ${xlsxPath}\n`);

  const buf = readFileSync(xlsxPath);
  const wb = XLSX.read(buf, { type: "buffer" });

  console.log(`📋 Found ${wb.SheetNames.length} sheets: ${wb.SheetNames.join(", ")}\n`);

  let totalInserted = 0;
  let totalUpdated = 0;
  let totalErrors = 0;
  let totalParsed = 0;

  for (const sheetName of wb.SheetNames) {
    const angkatan = SHEET_MAP[sheetName];
    if (!angkatan) {
      console.log(`⏭  Skipping sheet: ${sheetName}`);
      continue;
    }

    const ws = wb.Sheets[sheetName];
    const alumni = parseSheet(ws, angkatan);

    if (alumni.length === 0) {
      console.log(`⚠  ${sheetName} (TN ${angkatan}): No data found`);
      continue;
    }

    totalParsed += alumni.length;

    const result = await upsertAlumni(alumni, angkatan);
    totalInserted += result.inserted;
    totalUpdated += result.updated;
    totalErrors += result.errors;

    console.log(
      `✅ ${sheetName} → TN ${angkatan}: ${alumni.length} parsed, ` +
        `${result.inserted} inserted, ${result.updated} updated` +
        (result.errors ? `, ${result.errors} errors` : "")
    );
  }

  console.log(`\n${"═".repeat(60)}`);
  console.log(`📊 TOTAL: ${totalParsed} parsed, ${totalInserted} inserted, ${totalUpdated} updated, ${totalErrors} errors`);
  console.log(`${"═".repeat(60)}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
