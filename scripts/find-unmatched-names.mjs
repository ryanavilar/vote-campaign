/**
 * Find the names submitted for the unmatched NOSIS, and try to find possible
 * real NOSIS by fuzzy name match in master.
 */
import { readFileSync } from "fs";
import XLSX from "xlsx";

const masterWb = XLSX.read(readFileSync("master-data-nosis.xlsx"), { type: "buffer" });
const master = XLSX.utils.sheet_to_json(masterWb.Sheets["Sheet1"], { defval: null, raw: false });

function normNosis(s) {
  const digits = String(s ?? "").replace(/\D+/g, "");
  if (!digits) return "";
  return digits.length < 6 ? digits.padStart(6, "0") : digits;
}
function normName(s) {
  return String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

const TARGETS = [
  { src: "tn23-formdpt.xlsx", sheet: "Form responses 1", ang: 23, nosis: "125726" },
  { src: "tn23-formdpt.xlsx", sheet: "Form responses 1", ang: 23, nosis: "129722" },
  { src: "tn32-formdpt.xlsx", sheet: "Form responses 1", ang: 32, nosis: "2100008" },
];

for (const t of TARGETS) {
  const wb = XLSX.read(readFileSync(t.src), { type: "buffer" });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[t.sheet], { defval: null, raw: false });
  const row = rows.find((r) => normNosis(r["NOSIS (penulisan tanpa spasi e.g: 999999)"]) === t.nosis);
  if (!row) { console.log(`${t.src} ${t.nosis} — NOT FOUND in form?`); continue; }
  const name = row["Nama Lengkap"];
  const phone = row["Nomor WhatsApp yang terdaftar di Grup Angkatan"];
  console.log(`\n${t.src} TN${t.ang} NOSIS=${t.nosis}`);
  console.log(`  name: ${name}`);
  console.log(`  phone: ${phone}`);
  console.log(`  validate: ${row.Validate}`);

  // Fuzzy match by name in master
  const nn = normName(name);
  const hits = master.filter((m) => {
    const mn = normName(m.name);
    if (!mn) return false;
    return mn === nn || mn.includes(nn) || nn.includes(mn);
  }).slice(0, 5);
  if (hits.length) {
    console.log(`  master name matches:`);
    for (const h of hits) console.log(`    - NOSIS=${h.nosis_clean} "${h.name}" batch=${h.batch_id}`);
  } else {
    // Try token overlap (first 2 words)
    const tokens = nn.split(" ").filter(Boolean).slice(0, 2);
    if (tokens.length) {
      const fuzzy = master.filter((m) => {
        const mn = normName(m.name);
        return tokens.every((tk) => mn.includes(tk));
      }).slice(0, 5);
      if (fuzzy.length) {
        console.log(`  fuzzy name matches:`);
        for (const h of fuzzy) console.log(`    - NOSIS=${h.nosis_clean} "${h.name}" batch=${h.batch_id}`);
      } else {
        console.log(`  no name match in master`);
      }
    }
  }
}
