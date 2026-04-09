/**
 * seed-tn21-data.mjs
 *
 * Uses "TN21 Data Munas (not eligible).xlsx" to:
 * 1. Upsert alumni records (update names by NOSIS match, add missing)
 * 2. Create/update members linked to alumni via alumni_id
 *
 * Usage:
 *   node --env-file=.env.local scripts/seed-tn21-data.mjs [path-to-xlsx]
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";
import XLSX from "xlsx";

// Load .env.local
try {
  const envPath = resolve(process.cwd(), ".env.local");
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
    }
  }
  console.log("✅ .env.local loaded");
} catch {
  console.log("⚠️  .env.local not found, using existing environment variables");
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY harus diset!");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const ANGKATAN = 21;

// ---------------------------------------------------------------------------
// Parse Excel
// ---------------------------------------------------------------------------

const xlsxPath =
  process.argv[2] ||
  resolve(process.env.HOME, "Downloads", "TN21 Data Munas (not eligible).xlsx");

console.log(`📖 Reading: ${xlsxPath}\n`);

const buf = readFileSync(xlsxPath);
const wb = XLSX.read(buf, { type: "buffer" });
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

const excelData = [];
for (let i = 1; i < rows.length; i++) {
  const row = rows[i];
  if (!row || row.length < 2) continue;

  const nama = row[0] ? String(row[0]).trim() : null;
  const nosis = row[1] ? String(row[1]).trim() : null;
  const status = row[2] ? String(row[2]).trim() : null;

  if (!nama) continue;
  excelData.push({ nama, nosis, status });
}

console.log(`📋 Excel: ${excelData.length} alumni TN ${ANGKATAN}\n`);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalize(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findMatchByName(normName, map) {
  if (map.has(normName)) return map.get(normName);
  const parts = normName.split(" ");
  if (parts.length >= 2) {
    for (const [key, val] of map) {
      const kp = key.split(" ");
      if (
        kp.length >= 2 &&
        parts[0] === kp[0] &&
        parts[parts.length - 1] === kp[kp.length - 1]
      ) {
        return val;
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Step 1: Upsert Alumni
// ---------------------------------------------------------------------------

async function upsertAlumni() {
  console.log("━".repeat(60));
  console.log(`STEP 1: UPSERT ALUMNI TN ${ANGKATAN} (by NOSIS / name match)`);
  console.log("━".repeat(60));

  const { data: existingAlumni, error } = await supabase
    .from("alumni")
    .select("id, nosis, nama, angkatan")
    .eq("angkatan", ANGKATAN);

  if (error) {
    console.error("❌ Failed to fetch alumni:", error.message);
    return new Map();
  }

  console.log(`   Existing TN ${ANGKATAN} alumni: ${existingAlumni.length}`);

  const alumniByNosis = new Map();
  const alumniByNorm = new Map();
  for (const a of existingAlumni) {
    if (a.nosis) alumniByNosis.set(a.nosis, a);
    alumniByNorm.set(normalize(a.nama), a);
  }

  let updated = 0;
  let created = 0;
  let skipped = 0;

  const alumniResult = new Map();

  for (const excel of excelData) {
    const normExcel = normalize(excel.nama);

    let alumni = excel.nosis ? alumniByNosis.get(excel.nosis) : null;
    if (!alumni) {
      alumni = findMatchByName(normExcel, alumniByNorm);
    }

    if (alumni) {
      const updates = {};
      if (alumni.nama !== excel.nama) {
        updates.nama = excel.nama;
      }
      if (excel.nosis && alumni.nosis !== excel.nosis) {
        updates.nosis = excel.nosis;
      }

      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from("alumni")
          .update(updates)
          .eq("id", alumni.id);

        if (updateError) {
          console.error(`   ❌ Update alumni failed ${excel.nama}: ${updateError.message}`);
        } else {
          if (updates.nama) console.log(`   ✏️  Alumni: "${alumni.nama}" → "${updates.nama}"`);
          updated++;
        }
      } else {
        skipped++;
      }

      alumniResult.set(normExcel, { ...alumni, nama: excel.nama });
    } else {
      const { data: newAlumni, error: insertError } = await supabase
        .from("alumni")
        .insert({ nosis: excel.nosis, nama: excel.nama, angkatan: ANGKATAN })
        .select("id")
        .single();

      if (insertError) {
        console.error(`   ❌ Create alumni failed ${excel.nama}: ${insertError.message}`);
      } else {
        console.log(`   ✅ Alumni created: ${excel.nama} (NOSIS: ${excel.nosis})`);
        created++;
        alumniResult.set(normExcel, { id: newAlumni.id, nosis: excel.nosis, nama: excel.nama });
      }
    }
  }

  console.log(`\n   Alumni — Updated: ${updated}, Created: ${created}, Unchanged: ${skipped}\n`);
  return alumniResult;
}

// ---------------------------------------------------------------------------
// Step 2: Create/Update Members (linked to alumni)
// ---------------------------------------------------------------------------

async function upsertMembers(alumniResult) {
  console.log("━".repeat(60));
  console.log(`STEP 2: UPSERT MEMBERS TN ${ANGKATAN} (linked to alumni)`);
  console.log("━".repeat(60));

  const { data: existingMembers, error } = await supabase
    .from("members")
    .select("id, no, nama, angkatan, no_hp, alumni_id")
    .eq("angkatan", ANGKATAN)
    .order("no", { ascending: true });

  if (error) {
    console.error("❌ Failed to fetch members:", error.message);
    return;
  }

  console.log(`   Existing TN ${ANGKATAN} members: ${existingMembers.length}`);

  const membersByNorm = new Map();
  const membersByAlumniId = new Map();
  for (const m of existingMembers) {
    membersByNorm.set(normalize(m.nama), m);
    if (m.alumni_id) membersByAlumniId.set(m.alumni_id, m);
  }

  const { data: maxNoData } = await supabase
    .from("members")
    .select("no")
    .order("no", { ascending: false })
    .limit(1);

  let nextNo = maxNoData && maxNoData.length > 0 ? maxNoData[0].no + 1 : 1;

  let membersUpdated = 0;
  let membersCreated = 0;
  let membersSkipped = 0;

  for (const excel of excelData) {
    const normExcel = normalize(excel.nama);

    const alumni = alumniResult.get(normExcel);
    const alumniId = alumni ? alumni.id : null;

    let member = alumniId ? membersByAlumniId.get(alumniId) : null;
    if (!member) {
      member = findMatchByName(normExcel, membersByNorm);
    }

    if (member) {
      const updates = {};

      if (member.nama !== excel.nama) {
        updates.nama = excel.nama;
      }

      if (alumniId && member.alumni_id !== alumniId) {
        updates.alumni_id = alumniId;
      }

      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from("members")
          .update(updates)
          .eq("id", member.id);

        if (updateError) {
          console.error(`   ❌ Update member failed ${excel.nama}: ${updateError.message}`);
        } else {
          const changes = [];
          if (updates.nama) changes.push(`name: "${member.nama}" → "${updates.nama}"`);
          if (updates.alumni_id) changes.push(`linked alumni`);
          console.log(`   ✏️  ${excel.nama}: ${changes.join(", ")}`);
          membersUpdated++;
        }
      } else {
        membersSkipped++;
      }

      membersByNorm.delete(normalize(member.nama));
      if (member.alumni_id) membersByAlumniId.delete(member.alumni_id);
    } else {
      const { error: insertError } = await supabase
        .from("members")
        .insert({
          no: nextNo,
          nama: excel.nama,
          angkatan: ANGKATAN,
          no_hp: "",
          alumni_id: alumniId,
        });

      if (insertError) {
        console.error(`   ❌ Create member failed ${excel.nama}: ${insertError.message}`);
      } else {
        console.log(`   ✅ Member created: ${excel.nama} (No: ${nextNo}${alumniId ? ", linked" : ""})`);
        membersCreated++;
        nextNo++;
      }
    }
  }

  console.log(`\n   Members — Updated: ${membersUpdated}, Created: ${membersCreated}, Unchanged: ${membersSkipped}\n`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const alumniResult = await upsertAlumni();
  await upsertMembers(alumniResult);

  console.log("═".repeat(60));
  console.log("✅ Done!");
  console.log("═".repeat(60));
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
