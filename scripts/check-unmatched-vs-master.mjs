/**
 * Check unmatched NOSIS from form submissions against master-data-nosis.xlsx
 * to determine if they're real (typo in alumni table) or invalid (form error).
 */
import { readFileSync } from "fs";
import XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const wb = XLSX.read(readFileSync("master-data-nosis.xlsx"), { type: "buffer" });
const master = XLSX.utils.sheet_to_json(wb.Sheets["Sheet1"], { defval: null, raw: false });
const byNosis = new Map();
for (const r of master) {
  const n = String(r.nosis_clean ?? "").replace(/\D+/g, "");
  if (n) byNosis.set(n, r);
}

const UNMATCHED = [
  { src: "TN21", nosis: "365290" },
  { src: "TN21", nosis: "10603333" },
  { src: "TN21", nosis: "102097" },
  { src: "TN23", nosis: "125726" },
  { src: "TN23", nosis: "129722" },
  { src: "TN32", nosis: "2100008" },
];

for (const u of UNMATCHED) {
  const m = byNosis.get(u.nosis);
  let info = "";
  if (m) {
    info = `IN MASTER: "${m.name}" batch=${m.batch_id} valid=${m.nosis_valid}`;
  } else {
    // Try padding / without leading zeros
    const padded = u.nosis.padStart(6, "0");
    const m2 = byNosis.get(padded);
    if (m2) info = `IN MASTER (padded ${padded}): "${m2.name}" batch=${m2.batch_id}`;
    else info = "NOT IN MASTER";
  }
  console.log(`${u.src} ${u.nosis} → ${info}`);

  // Also check if alumni exists in DB
  const { data: alumni } = await supabase
    .from("alumni")
    .select("id, nosis, nama, angkatan")
    .eq("nosis", u.nosis)
    .maybeSingle();
  if (alumni) console.log(`    DB alumni: ${alumni.nosis} "${alumni.nama}" TN${alumni.angkatan}`);
  else console.log(`    DB: no alumni row`);
}
