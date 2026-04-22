/**
 * Auto-create member rows for alumni who submitted a VALID DPT form but
 * don't yet have a member row linked. Uses no_hp from the form if present.
 *
 * Sets isi_form_dpt = "Sudah" immediately on create.
 *
 * Usage:
 *   node --env-file=.env.local scripts/auto-create-members-from-valid-form.mjs [--apply]
 */
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import XLSX from "xlsx";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const APPLY = process.argv.includes("--apply");

const SOURCES = [
  {
    ang: 15,
    file: "tn15-dpt.xlsx",
    sheet: "COPY FORM",
    nosisCol: "NOSIS",
    phoneCol: null,
    filter: (r) => String(r.Validate || "").trim().toLowerCase() === "valid",
  },
  {
    ang: 17,
    file: "tn17-formdpt.xlsx",
    sheet: "Form responses 1",
    nosisCol: "NOSIS (penulisan tanpa spasi e.g: 999999)",
    phoneCol: "Nomor WhatsApp yang terdaftar di Grup Angkatan",
    filter: (r) => String(r.Validate || "").trim().toLowerCase() === "valid",
  },
  {
    ang: 18,
    file: "tn18-formdpt.xlsx",
    sheet: "Sheet1",
    nosisCol: "Nosis",
    phoneCol: null,
    filter: () => true,
  },
  {
    ang: 20,
    file: "tn20-formdpt.xlsx",
    sheet: "Form responses 1",
    nosisCol: "NOSIS (penulisan tanpa spasi e.g: 999999)",
    phoneCol: "Nomor WhatsApp yang terdaftar di Grup Angkatan",
    filter: (r) => String(r.Validate || "").trim().toLowerCase() === "valid",
  },
  {
    ang: 21,
    file: "tn21-formdpt.xlsx",
    sheet: "Form responses 1",
    nosisCol: "NOSIS (penulisan tanpa spasi e.g: 999999)",
    phoneCol: "Nomor WhatsApp yang terdaftar di Grup Angkatan",
    filter: (r) => String(r.Validate || "").trim().toLowerCase() === "valid",
  },
  {
    ang: 23,
    file: "tn23-formdpt.xlsx",
    sheet: "Form responses 1",
    nosisCol: "NOSIS (penulisan tanpa spasi e.g: 999999)",
    phoneCol: "Nomor WhatsApp yang terdaftar di Grup Angkatan",
    filter: (r) => String(r.Validate || "").trim().toLowerCase() === "valid",
  },
  {
    ang: 26,
    file: "tn26-formdpt.xlsx",
    sheet: "Form responses 1",
    nosisCol: "NOSIS (penulisan tanpa spasi e.g: 999999)",
    phoneCol: "Nomor WhatsApp yang terdaftar di Grup Angkatan",
    filter: (r) => String(r.Validate || "").trim().toLowerCase() === "valid",
  },
  {
    ang: 27,
    file: "tn27-formdpt.xlsx",
    sheet: "Form responses 1",
    nosisCol: "NOSIS (penulisan tanpa spasi e.g: 999999)",
    phoneCol: "Nomor WhatsApp yang terdaftar di Grup Angkatan",
    filter: (r) => String(r.Validate || "").trim().toLowerCase() === "valid",
  },
  {
    ang: 30,
    file: "tn30-formdpt.xlsx",
    sheet: "Form responses 1",
    nosisCol: "NOSIS (penulisan tanpa spasi e.g: 999999)",
    phoneCol: "Nomor WhatsApp yang terdaftar di Grup Angkatan",
    filter: (r) => String(r.Validate || "").trim().toLowerCase() === "valid",
  },
  {
    ang: 31,
    file: "tn31-formdpt.xlsx",
    sheet: "Form responses 1",
    nosisCol: "NOSIS (penulisan tanpa spasi e.g: 999999)",
    phoneCol: "Nomor WhatsApp yang terdaftar di Grup Angkatan",
    filter: (r) => String(r.Validate || "").trim().toLowerCase() === "valid",
  },
  {
    ang: 32,
    file: "tn32-formdpt.xlsx",
    sheet: "Form responses 1",
    nosisCol: "NOSIS (penulisan tanpa spasi e.g: 999999)",
    phoneCol: "Nomor WhatsApp yang terdaftar di Grup Angkatan",
    filter: (r) => String(r.Validate || "").trim().toLowerCase() === "valid",
  },
  {
    ang: 33,
    file: "tn33-formdpt.xlsx",
    sheet: "Form responses 1",
    nosisCol: "NOSIS (penulisan tanpa spasi e.g: 999999)",
    phoneCol: "Nomor WhatsApp yang terdaftar di Grup Angkatan",
    filter: (r) => String(r.Validate || "").trim().toLowerCase() === "valid",
  },
];

function normNosis(s) {
  const digits = String(s ?? "").replace(/\D+/g, "");
  if (!digits) return "";
  return digits.length < 6 ? digits.padStart(6, "0") : digits;
}

function normPhone(p) {
  if (!p) return null;
  let s = String(p).replace(/\s+/g, "").replace(/[^\d+]/g, "");
  if (s.startsWith("0")) s = "62" + s.slice(1);
  if (s.startsWith("+")) s = s.slice(1);
  if (!s) return null;
  return s;
}

console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"}\n`);

// Get current max(no) once
const { data: maxRow, error: eMax } = await supabase
  .from("members")
  .select("no")
  .order("no", { ascending: false })
  .limit(1)
  .single();
if (eMax) throw eMax;
let nextNo = (maxRow.no ?? 0) + 1;
console.log(`Starting no: ${nextNo}\n`);

const toInsert = [];
for (const src of SOURCES) {
  console.log(`=== TN${src.ang} ===`);
  const wb = XLSX.read(readFileSync(src.file), { type: "buffer" });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[src.sheet], { defval: null, raw: false });
  const valid = rows.filter(src.filter);

  // Map NOSIS → phone (first occurrence)
  const phoneByNosis = new Map();
  const nosisSet = new Set();
  for (const r of valid) {
    const n = normNosis(r[src.nosisCol]);
    if (!n) continue;
    nosisSet.add(n);
    if (src.phoneCol) {
      const p = normPhone(r[src.phoneCol]);
      if (p && !phoneByNosis.has(n)) phoneByNosis.set(n, p);
    }
  }

  const nosisList = [...nosisSet];

  const { data: alumni } = await supabase
    .from("alumni")
    .select("id, nosis, nama, angkatan")
    .eq("angkatan", src.ang)
    .in("nosis", nosisList);

  const { data: existingMembers } = await supabase
    .from("members")
    .select("id, alumni_id")
    .in("alumni_id", alumni.map((a) => a.id));
  const linkedAlumniIds = new Set(existingMembers.map((m) => m.alumni_id));

  const missing = alumni.filter((a) => !linkedAlumniIds.has(a.id));
  console.log(`Valid alumni: ${alumni.length}, already have member row: ${alumni.length - missing.length}, will create: ${missing.length}`);

  for (const a of missing) {
    const phone = phoneByNosis.get(a.nosis);
    const row = {
      no: nextNo++,
      nama: a.nama,
      angkatan: a.angkatan,
      no_hp: phone || "-",
      alumni_id: a.id,
      isi_form_dpt: "Sudah",
      sudah_dikontak: "Belum",
      masuk_grup: "Belum",
      registrasi_website_dpt: "Belum",
      status_dpt: null,
      vote: "Belum",
      dukungan: null,
    };
    toInsert.push(row);
    if (toInsert.length <= 5 || missing.indexOf(a) < 3) {
      console.log(`  + no=${row.no} ${a.nosis} "${a.nama}" phone=${phone || "(none)"}`);
    }
  }
}

console.log(`\nTotal to insert: ${toInsert.length}`);

if (APPLY && toInsert.length > 0) {
  let ok = 0, err = 0;
  for (let i = 0; i < toInsert.length; i += 200) {
    const chunk = toInsert.slice(i, i + 200);
    const { error, data } = await supabase.from("members").insert(chunk).select("id");
    if (error) {
      err += chunk.length;
      console.error(`  ❌ batch err:`, error.message);
      // Individual fallback
      for (const item of chunk) {
        const { error: e2 } = await supabase.from("members").insert(item);
        if (e2) console.error(`    ❌ ${item.nama}: ${e2.message}`);
        else { ok++; err--; }
      }
    } else {
      ok += data.length;
    }
  }
  console.log(`\n→ Applied: ${ok} inserted, ${err} errors`);
}
if (!APPLY) console.log("\n→ Re-run with --apply to write.");
