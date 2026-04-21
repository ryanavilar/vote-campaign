/**
 * fix-nosis-names-from-master.mjs
 *
 * Uses Master_Data_NOSIS.xlsx (columns: nosis_clean, name, batch_id) to
 * reconcile alumni + members rows.
 *
 * Match strategy per Excel row (scoped to angkatan = batch_id):
 *   1. NOSIS match — alumni.nosis = excel.nosis_clean. Safest.
 *   2. Name match — alumni.nama (normalized) = excel.name (normalized), only
 *      used when NOSIS has no hit.
 *
 * Writes:
 *   - alumni.nama   → set to excel.name if different (after NOSIS/name match)
 *   - alumni.nosis  → set to excel.nosis_clean if matched by name only (NOSIS
 *                     empty or wrong in DB)
 *   - members.nama  → synced to alumni.nama for every member linked to an
 *                     alumni whose name was just updated
 *   - insert new alumni if neither NOSIS nor name match (angkatan scope)
 *
 * Usage:
 *   # preview (default)
 *   node --env-file=.env.local scripts/fix-nosis-names-from-master.mjs [path.xlsx]
 *   # apply changes
 *   node --env-file=.env.local scripts/fix-nosis-names-from-master.mjs [path.xlsx] --apply
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import XLSX from "xlsx";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const APPLY = process.argv.includes("--apply");

function normalize(s) {
  if (s == null) return "";
  return String(s).toLowerCase().trim().replace(/\s+/g, " ");
}

const ROMAN_RE = /^(i{1,3}|iv|v|vi{0,3}|ix|x{1,3}|xl|l|c|d|m)$/i;

function capWord(w) {
  if (!w) return w;
  if (ROMAN_RE.test(w)) return w.toUpperCase();
  if (w.includes(".")) {
    return w
      .split(".")
      .map((p) => (p ? p[0].toUpperCase() + p.slice(1) : p))
      .join(".");
  }
  return w[0].toUpperCase() + w.slice(1);
}

function toTitleCase(s) {
  if (s == null) return "";
  return String(s)
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .split(" ")
    .map((word) => word.split("-").map(capWord).join("-"))
    .join(" ");
}

async function fetchAlumniByAngkatan(angkatan) {
  let all = [];
  let from = 0;
  const step = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("alumni")
      .select("id, nama, nosis")
      .eq("angkatan", angkatan)
      .range(from, from + step - 1);
    if (error) throw error;
    all = all.concat(data || []);
    if (!data || data.length < step) break;
    from += step;
  }
  return all;
}

async function fetchMembersByAlumniIds(ids) {
  if (ids.length === 0) return [];
  let all = [];
  for (let i = 0; i < ids.length; i += 300) {
    const chunk = ids.slice(i, i + 300);
    const { data, error } = await supabase
      .from("members")
      .select("id, nama, alumni_id")
      .in("alumni_id", chunk);
    if (error) throw error;
    all = all.concat(data || []);
  }
  return all;
}

async function main() {
  const xlsxPath =
    process.argv.find((a, i) => i >= 2 && !a.startsWith("--")) ||
    resolve(process.cwd(), "Master_Data_NOSIS.xlsx");

  console.log(`Reading: ${xlsxPath}`);
  console.log(`Mode:    ${APPLY ? "APPLY (will write)" : "DRY-RUN (no writes)"}`);
  console.log("");

  const buf = readFileSync(xlsxPath);
  const wb = XLSX.read(buf, { type: "buffer" });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

  const byBatch = {};
  for (const r of rows) {
    const b = Number(r.batch_id);
    if (!Number.isFinite(b)) continue;
    if (!byBatch[b]) byBatch[b] = [];
    byBatch[b].push(r);
  }

  const batches = Object.keys(byBatch).map(Number).sort((a, b) => a - b);

  const totals = {
    excelRows: 0,
    matchedByNosis: 0,
    matchedByName: 0,
    nameUpdated: 0,
    nosisUpdated: 0,
    alreadyOk: 0,
    inserted: 0,
    insertErrors: 0,
    updateErrors: 0,
    memberNameSynced: 0,
    memberSyncErrors: 0,
    dbOnly: 0,
    excelDupSkipped: 0,
    sampleNameDiffs: [],
    sampleNosisDiffs: [],
  };

  for (const angkatan of batches) {
    const excelRows = byBatch[angkatan];
    const dbRows = await fetchAlumniByAngkatan(angkatan);

    const dbByNosis = new Map();
    const dbByName = new Map();
    for (const d of dbRows) {
      if (d.nosis) dbByNosis.set(String(d.nosis).trim(), d);
      dbByName.set(normalize(d.nama), d);
    }

    const seenKey = new Set();
    const updatedAlumniIds = new Set();
    let updated = 0;
    let alreadyOk = 0;
    let inserted = 0;
    let nameUpd = 0;
    let nosisUpd = 0;
    let errors = 0;
    let mByNosis = 0;
    let mByName = 0;
    let dupSkipped = 0;
    const toInsert = [];

    for (const row of excelRows) {
      const nosis = String(row.nosis_clean).trim();
      const rawName = String(row.name || "").trim();
      const name = toTitleCase(rawName);
      if (!nosis || !name) continue;

      const dedupeKey = `${angkatan}:${nosis}`;
      if (seenKey.has(dedupeKey)) { dupSkipped++; continue; }
      seenKey.add(dedupeKey);

      let db = dbByNosis.get(nosis);
      let matchedBy = null;
      if (db) {
        matchedBy = "nosis";
        mByNosis++;
      } else {
        db = dbByName.get(normalize(name));
        if (db) {
          matchedBy = "name";
          mByName++;
        }
      }

      if (db) {
        const updates = {};
        if (matchedBy === "name" && db.nosis !== nosis) {
          updates.nosis = nosis;
          if (totals.sampleNosisDiffs.length < 10) {
            totals.sampleNosisDiffs.push({
              angkatan,
              nama: db.nama,
              dbNosis: db.nosis,
              newNosis: nosis,
            });
          }
        }
        if (db.nama !== name) {
          updates.nama = name;
          if (totals.sampleNameDiffs.length < 10) {
            totals.sampleNameDiffs.push({
              angkatan,
              dbNama: db.nama,
              newNama: name,
              nosis,
            });
          }
        }

        if (Object.keys(updates).length === 0) {
          alreadyOk++;
          continue;
        }

        if (updates.nama) nameUpd++;
        if (updates.nosis) nosisUpd++;

        if (APPLY) {
          const { error } = await supabase
            .from("alumni")
            .update(updates)
            .eq("id", db.id);
          if (error) {
            errors++;
            console.error(
              `  ❌ TN${angkatan} nosis=${nosis} "${db.nama}" → "${name}" (id=${db.id}): ${error.message}`
            );
            continue;
          }
        }
        if (updates.nama) updatedAlumniIds.add(db.id);
        updated++;
      } else {
        toInsert.push({ nama: name, angkatan, nosis });
      }
    }

    // Batch insert new alumni
    if (APPLY && toInsert.length > 0) {
      for (let i = 0; i < toInsert.length; i += 500) {
        const chunk = toInsert.slice(i, i + 500);
        const { error } = await supabase.from("alumni").insert(chunk);
        if (error) {
          // fallback individual
          for (const item of chunk) {
            const { error: e2 } = await supabase.from("alumni").insert(item);
            if (e2) totals.insertErrors++;
            else inserted++;
          }
        } else {
          inserted += chunk.length;
        }
      }
    } else {
      inserted = toInsert.length; // for dry-run accounting
    }

    // Sync members.nama for every alumni whose nama we just updated
    let memberSynced = 0;
    let memberErrs = 0;
    if (updatedAlumniIds.size > 0) {
      const updatedAlumniList = dbRows.filter((d) => updatedAlumniIds.has(d.id));
      const newNameById = new Map();
      // We already updated in-memory via `updates.nama = name` — refetch from excel map
      const excelByNosis = new Map();
      const excelByName = new Map();
      for (const r of excelRows) {
        const nosis = String(r.nosis_clean).trim();
        const name = toTitleCase(String(r.name || "").trim());
        if (nosis) excelByNosis.set(nosis, name);
        if (name) excelByName.set(normalize(name), name);
      }
      for (const a of updatedAlumniList) {
        const newName =
          (a.nosis && excelByNosis.get(String(a.nosis).trim())) ||
          excelByName.get(normalize(a.nama));
        if (newName && newName !== a.nama) newNameById.set(a.id, newName);
      }

      const memberRows = await fetchMembersByAlumniIds(
        Array.from(newNameById.keys())
      );
      for (const m of memberRows) {
        const newName = newNameById.get(m.alumni_id);
        if (!newName || m.nama === newName) continue;
        if (APPLY) {
          const { error } = await supabase
            .from("members")
            .update({ nama: newName })
            .eq("id", m.id);
          if (error) memberErrs++;
          else memberSynced++;
        } else {
          memberSynced++;
        }
      }
    }

    // DB rows not covered by any Excel row
    const coveredDbIds = new Set();
    for (const r of excelRows) {
      const ns = String(r.nosis_clean).trim();
      const nm = normalize(r.name);
      const hit = dbByNosis.get(ns) || dbByName.get(nm);
      if (hit) coveredDbIds.add(hit.id);
    }
    const dbOnly = dbRows.filter((d) => !coveredDbIds.has(d.id)).length;

    console.log(
      `TN ${String(angkatan).padStart(2)}: ` +
      `${excelRows.length} excel / ${dbRows.length} db | ` +
      `match nosis=${mByNosis} name=${mByName} | ` +
      `upd name=${nameUpd} nosis=${nosisUpd} ok=${alreadyOk} new=${inserted}` +
      (memberSynced > 0 ? `, members=${memberSynced}` : "") +
      (dbOnly > 0 ? `, db-only=${dbOnly}` : "") +
      (dupSkipped > 0 ? `, dup=${dupSkipped}` : "") +
      (errors > 0 ? `, err=${errors}` : "")
    );

    totals.excelRows += excelRows.length;
    totals.matchedByNosis += mByNosis;
    totals.matchedByName += mByName;
    totals.nameUpdated += nameUpd;
    totals.nosisUpdated += nosisUpd;
    totals.alreadyOk += alreadyOk;
    totals.inserted += inserted;
    totals.updateErrors += errors;
    totals.memberNameSynced += memberSynced;
    totals.memberSyncErrors += memberErrs;
    totals.dbOnly += dbOnly;
    totals.excelDupSkipped += dupSkipped;
  }

  console.log(`\n${"=".repeat(72)}`);
  console.log(`MODE: ${APPLY ? "APPLIED" : "DRY-RUN (no writes)"}`);
  console.log(`Excel rows:        ${totals.excelRows}`);
  console.log(`Matched by NOSIS:  ${totals.matchedByNosis}`);
  console.log(`Matched by name:   ${totals.matchedByName}`);
  console.log(`Name updates:      ${totals.nameUpdated}`);
  console.log(`NOSIS updates:     ${totals.nosisUpdated}`);
  console.log(`Already ok:        ${totals.alreadyOk}`);
  console.log(`Alumni inserts:    ${totals.inserted}`);
  console.log(`Member name sync:  ${totals.memberNameSynced}`);
  console.log(`DB-only (unmatched in Excel): ${totals.dbOnly}`);
  console.log(`Excel dup-skipped: ${totals.excelDupSkipped}`);
  if (totals.updateErrors || totals.insertErrors || totals.memberSyncErrors) {
    console.log(
      `Errors: alumni-upd=${totals.updateErrors} alumni-ins=${totals.insertErrors} mbr=${totals.memberSyncErrors}`
    );
  }
  console.log(`${"=".repeat(72)}`);

  if (totals.sampleNameDiffs.length) {
    console.log(`\nSample name diffs (first ${totals.sampleNameDiffs.length}):`);
    for (const d of totals.sampleNameDiffs) {
      console.log(`  TN${d.angkatan} ${d.nosis}: "${d.dbNama}" → "${d.newNama}"`);
    }
  }
  if (totals.sampleNosisDiffs.length) {
    console.log(`\nSample NOSIS diffs (first ${totals.sampleNosisDiffs.length}):`);
    for (const d of totals.sampleNosisDiffs) {
      console.log(`  TN${d.angkatan} ${d.nama}: "${d.dbNosis}" → "${d.newNosis}"`);
    }
  }

  if (!APPLY) {
    console.log(`\n→ Re-run with --apply to write changes.`);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
