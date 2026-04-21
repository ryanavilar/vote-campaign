/**
 * Investigator: lists alumni pairs where rename-to-excel would collide on
 * unique (nama, angkatan).
 *
 * Usage:
 *   node --env-file=.env.local scripts/find-nosis-name-conflicts.mjs
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import XLSX from "xlsx";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function normalize(s) {
  return String(s ?? "").toLowerCase().trim().replace(/\s+/g, " ");
}
const ROMAN_RE = /^(i{1,3}|iv|v|vi{0,3}|ix|x{1,3}|xl|l|c|d|m)$/i;
function capWord(w) {
  if (!w) return w;
  if (ROMAN_RE.test(w)) return w.toUpperCase();
  if (w.includes(".")) return w.split(".").map((p) => (p ? p[0].toUpperCase() + p.slice(1) : p)).join(".");
  return w[0].toUpperCase() + w.slice(1);
}
function toTitleCase(s) {
  if (s == null) return "";
  return String(s).trim().replace(/\s+/g, " ").toLowerCase()
    .split(" ").map((w) => w.split("-").map(capWord).join("-")).join(" ");
}

async function fetchAlumni(ang) {
  let all = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase.from("alumni")
      .select("id, nama, nosis, angkatan").eq("angkatan", ang).range(from, from + 999);
    if (error) throw error;
    all = all.concat(data || []);
    if (!data || data.length < 1000) break;
    from += 1000;
  }
  return all;
}

async function main() {
  const xlsxPath = resolve(process.cwd(), "Master_Data_NOSIS.xlsx");
  const buf = readFileSync(xlsxPath);
  const wb = XLSX.read(buf, { type: "buffer" });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

  const byBatch = {};
  for (const r of rows) {
    const b = Number(r.batch_id);
    if (!Number.isFinite(b)) continue;
    (byBatch[b] ||= []).push(r);
  }

  const conflicts = [];
  for (const ang of Object.keys(byBatch).map(Number).sort((a, b) => a - b)) {
    const excel = byBatch[ang];
    const db = await fetchAlumni(ang);
    const dbByNosis = new Map();
    const dbByName = new Map();
    const dbById = new Map();
    for (const d of db) {
      dbById.set(d.id, d);
      if (d.nosis) dbByNosis.set(String(d.nosis).trim(), d);
      dbByName.set(normalize(d.nama), d);
    }

    // Plan renames: alumniId -> newName
    const planned = new Map();
    for (const r of excel) {
      const nosis = String(r.nosis_clean).trim();
      const newName = toTitleCase(String(r.name || "").trim());
      if (!nosis || !newName) continue;
      let target = dbByNosis.get(nosis) || dbByName.get(normalize(newName));
      if (!target) continue;
      if (target.nama !== newName) planned.set(target.id, newName);
    }

    // Simulate: for each planned rename, would another alumni (not this one) end up with same name?
    // Build final-name map: for each id, its name after applying planned changes (or current if unchanged)
    const finalName = new Map();
    for (const d of db) finalName.set(d.id, planned.get(d.id) ?? d.nama);

    // Find collisions: two ids with same final name
    const bucket = new Map();
    for (const [id, name] of finalName) {
      const key = normalize(name);
      if (!bucket.has(key)) bucket.set(key, []);
      bucket.get(key).push(id);
    }
    for (const [key, ids] of bucket) {
      if (ids.length < 2) continue;
      // Report only if at least one id has a planned rename (otherwise pre-existing dup, not our problem)
      if (!ids.some((id) => planned.has(id))) continue;
      for (const id of ids) {
        const d = dbById.get(id);
        const excelPlan = planned.get(id);
        conflicts.push({
          angkatan: ang,
          id,
          nosis: d.nosis,
          dbName: d.nama,
          newName: excelPlan || "(no change)",
          colliderIds: ids.filter((x) => x !== id),
        });
      }
    }
  }

  // Group by (angkatan, finalName)
  const grouped = new Map();
  for (const c of conflicts) {
    const key = `${c.angkatan}::${normalize(c.newName === "(no change)" ? c.dbName : c.newName)}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(c);
  }

  console.log(`\nConflicts: ${grouped.size} unique (angkatan, name) pairs affecting ${conflicts.length} alumni rows\n`);
  for (const [key, list] of [...grouped.entries()].sort()) {
    const ang = list[0].angkatan;
    const finalName = list[0].newName === "(no change)" ? list[0].dbName : list[0].newName;
    console.log(`TN${ang} — "${finalName}"`);
    for (const c of list) {
      const mark = c.newName === "(no change)" ? "stays" : "rename";
      console.log(`  [${mark}] nosis=${c.nosis || "-"} dbName="${c.dbName}" → "${c.newName}"`);
    }
    console.log("");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
