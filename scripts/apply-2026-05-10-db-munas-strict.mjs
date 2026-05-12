/**
 * Source-of-truth sync from DB MUNAS xlsx (panitia data).
 *  - Each row in file: form_dpt=Sudah, web_dpt + status_dpt = Sudah jika registered=Y
 *  - Each row with registered=N: form_dpt=Sudah, web_dpt=Belum, status_dpt=null
 *  - NOSIS yang TIDAK ada di file: form_dpt=Belum, web_dpt=Belum, status_dpt=null
 *
 * Tidak mengubah dukungan, kontak, no_hp, dll — hanya 3 kolom DPT funnel.
 */
import XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const APPLY = process.argv.includes("--apply");

function nn(s) { const d = String(s ?? "").replace(/\D+/g, ""); return d ? (d.length < 6 ? d.padStart(6, "0") : d) : ""; }

const wb = XLSX.readFile("/tmp/db-munas.xlsx");
const rows = XLSX.utils.sheet_to_json(wb.Sheets["Data"], { defval: "" });
const fileMap = new Map();
for (const r of rows) {
  const nos = nn(r.nis);
  if (!nos) continue;
  const reg = String(r.registered || "").trim().toUpperCase() === "Y";
  fileMap.set(nos, { reg });
}
console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"}`);
console.log(`File rows with NOSIS: ${fileMap.size} (registered Y: ${[...fileMap.values()].filter(v => v.reg).length})\n`);

// Fetch all alumni
const allAlumni = [];
for (let from = 0; ; from += 1000) {
  const { data } = await supabase.from("alumni").select("id, nosis, nama, angkatan").range(from, from + 999);
  if (!data || !data.length) break;
  allAlumni.push(...data);
  if (data.length < 1000) break;
}
const alumniById = new Map(allAlumni.map((a) => [a.id, a]));
console.log(`Alumni in DB: ${allAlumni.length}`);

// Fetch all members
const allMembers = [];
for (let from = 0; ; from += 1000) {
  const { data } = await supabase.from("members").select("id, alumni_id, nama, isi_form_dpt, registrasi_website_dpt, status_dpt").range(from, from + 999);
  if (!data || !data.length) break;
  allMembers.push(...data);
  if (data.length < 1000) break;
}
console.log(`Members in DB: ${allMembers.length}`);

const updates = [];
let already = 0, noAlumni = 0;
for (const m of allMembers) {
  const a = alumniById.get(m.alumni_id);
  if (!a) { noAlumni++; continue; }
  const file = fileMap.get(a.nosis);
  const targetForm = file ? "Sudah" : "Belum";
  const targetWeb = file && file.reg ? "Sudah" : "Belum";
  const targetStatus = file && file.reg ? "Sudah" : null;
  const patch = {};
  if (m.isi_form_dpt !== targetForm) patch.isi_form_dpt = targetForm;
  if (m.registrasi_website_dpt !== targetWeb) patch.registrasi_website_dpt = targetWeb;
  if (m.status_dpt !== targetStatus) patch.status_dpt = targetStatus;
  if (Object.keys(patch).length === 0) already++;
  else updates.push({ id: m.id, nama: m.nama, nosis: a.nosis, patch });
}

// Also create members for alumni in file that don't have member yet
const haveMember = new Set(allMembers.map((m) => m.alumni_id));
const toCreate = [];
for (const a of allAlumni) {
  if (haveMember.has(a.id)) continue;
  const file = fileMap.get(a.nosis);
  if (!file) continue; // not in source-of-truth file → skip
  toCreate.push({ alumni: a, reg: file.reg });
}

// Categorize updates
const setForm = updates.filter((u) => u.patch.isi_form_dpt === "Sudah").length;
const unsetForm = updates.filter((u) => u.patch.isi_form_dpt === "Belum").length;
const setWeb = updates.filter((u) => u.patch.registrasi_website_dpt === "Sudah").length;
const unsetWeb = updates.filter((u) => u.patch.registrasi_website_dpt === "Belum").length;
console.log(`\nMembers: already=${already}, updates=${updates.length}, no-alumni=${noAlumni}, create=${toCreate.length}`);
console.log(`  Form: ${setForm} → Sudah, ${unsetForm} → Belum`);
console.log(`  Web/DPT: ${setWeb} → Sudah, ${unsetWeb} → Belum`);

if (!APPLY) { console.log("\n→ --apply"); process.exit(0); }

let updated = 0, created = 0;
for (const u of updates) {
  const { error } = await supabase.from("members").update(u.patch).eq("id", u.id);
  if (!error) updated++;
}
if (toCreate.length) {
  const { data: maxRow } = await supabase.from("members").select("no").order("no", { ascending: false }).limit(1).single();
  let no = (maxRow.no ?? 0) + 1;
  for (let i = 0; i < toCreate.length; i += 200) {
    const chunk = toCreate.slice(i, i + 200);
    const insRows = chunk.map((c) => ({
      no: no++, nama: c.alumni.nama || "(unknown)", angkatan: c.alumni.angkatan, no_hp: "-", alumni_id: c.alumni.id,
      isi_form_dpt: "Sudah", sudah_dikontak: "Belum", masuk_grup: "Belum",
      registrasi_website_dpt: c.reg ? "Sudah" : "Belum",
      status_dpt: c.reg ? "Sudah" : null,
      vote: "Belum", dukungan: null,
    }));
    const { data, error } = await supabase.from("members").insert(insRows).select("id");
    if (error) console.error(`create chunk ${i}:`, error.message);
    else created += data.length;
  }
}
console.log(`\n→ updated=${updated}, created=${created}`);
