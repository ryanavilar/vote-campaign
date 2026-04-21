/**
 * For each conflict pair, show what Excel says about the "stays" row's NOSIS.
 * If Excel has a different name for it → alumni B was mislabeled, we should
 * rename B first (freeing up the slot for A).
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import XLSX from "xlsx";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function normalize(s) { return String(s ?? "").toLowerCase().trim().replace(/\s+/g, " "); }
const ROMAN_RE = /^(i{1,3}|iv|v|vi{0,3}|ix|x{1,3}|xl|l|c|d|m)$/i;
function capWord(w) { if (!w) return w; if (ROMAN_RE.test(w)) return w.toUpperCase(); if (w.includes(".")) return w.split(".").map((p) => (p ? p[0].toUpperCase() + p.slice(1) : p)).join("."); return w[0].toUpperCase() + w.slice(1); }
function toTitleCase(s) { if (s == null) return ""; return String(s).trim().replace(/\s+/g, " ").toLowerCase().split(" ").map((w) => w.split("-").map(capWord).join("-")).join(" "); }

const xlsxPath = resolve(process.cwd(), "Master_Data_NOSIS.xlsx");
const wb = XLSX.read(readFileSync(xlsxPath), { type: "buffer" });
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

const excelByNosis = new Map();
const excelByAngName = new Map();
for (const r of rows) {
  const nosis = String(r.nosis_clean).trim();
  const name = toTitleCase(String(r.name || "").trim());
  const ang = Number(r.batch_id);
  if (!nosis || !name || !Number.isFinite(ang)) continue;
  excelByNosis.set(nosis, { name, ang });
  const k = `${ang}::${normalize(name)}`;
  if (!excelByAngName.has(k)) excelByAngName.set(k, []);
  excelByAngName.get(k).push({ nosis, name });
}

async function fetchAng(ang) {
  let all = [];
  let from = 0;
  while (true) {
    const { data } = await supabase.from("alumni").select("id, nama, nosis, angkatan").eq("angkatan", ang).range(from, from + 999);
    all = all.concat(data || []);
    if (!data || data.length < 1000) break;
    from += 1000;
  }
  return all;
}

const pairs = [
  { ang: 1, nosisList: ["900083", "908383"] },
  { ang: 2, nosisList: ["910319", "910357"] },
  { ang: 13, nosisList: ["023406", "023407"] },
  { ang: 19, nosisList: ["085234", "085412"] },
  { ang: 27, nosisList: ["168118", "168119"] },
  { ang: 28, nosisList: ["174186", "178568"] },
];

// Also find TN13's extra ones
const tn13 = await fetchAng(13);

console.log("=== Known pairs ===\n");
for (const p of pairs) {
  const db = await fetchAng(p.ang);
  for (const n of p.nosisList) {
    const d = db.find((x) => x.nosis === n);
    const e = excelByNosis.get(n);
    console.log(`TN${p.ang} NOSIS ${n}:`);
    console.log(`  DB:    ${d ? `"${d.nama}"` : "(not in DB)"}`);
    console.log(`  Excel: ${e ? `"${e.name}" (TN${e.ang})` : "(not in Excel)"}`);
  }
  console.log("");
}

console.log("=== TN13 planned renames that would collide ===\n");
// Excel TN13 title-case name duplicates
const nameCount = new Map();
for (const [k, list] of excelByAngName) {
  if (!k.startsWith("13::")) continue;
  if (list.length > 1) nameCount.set(k, list);
}
console.log(`Excel TN13 name duplicates: ${nameCount.size}`);
for (const [k, list] of nameCount) {
  console.log(`  "${list[0].name}" × ${list.length}: nosis=${list.map((x) => x.nosis).join(", ")}`);
}

// Also check TN13 DB alumni whose NOSIS isn't in Excel
console.log("\nTN13 DB alumni NOT in Excel (by NOSIS):");
const excelN13 = new Set([...excelByNosis.entries()].filter(([_, v]) => v.ang === 13).map(([k]) => k));
for (const d of tn13) {
  if (!d.nosis || !excelN13.has(String(d.nosis).trim())) {
    console.log(`  id=${d.id} nosis=${d.nosis} nama="${d.nama}"`);
  }
}
