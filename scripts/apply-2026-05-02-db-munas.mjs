/**
 * Apply DATA IN DB MUNAS.xlsx — semua alumni yang sudah Form DPT.
 *  - Setiap baris → isi_form_dpt=Sudah
 *  - registered="Y" → registrasi_website_dpt + status_dpt = Sudah (asumsi user: web=DPT)
 *  - NOSIS unmatched → buat alumni baru (sesuai rule)
 */
import XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const APPLY = process.argv.includes("--apply");

function nn(s) { const d = String(s ?? "").replace(/\D+/g, ""); return d ? (d.length < 6 ? d.padStart(6, "0") : d) : ""; }
function romanToInt(r) {
  const map = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let total = 0, prev = 0;
  for (let i = r.length - 1; i >= 0; i--) {
    const v = map[r[i]];
    total += v < prev ? -v : v;
    prev = v;
  }
  return total;
}

const wb = XLSX.readFile("/tmp/db-munas.xlsx");
const rows = XLSX.utils.sheet_to_json(wb.Sheets["Data"], { defval: "" });
const records = rows.map((r) => ({
  nosis: nn(r.nis),
  nama: String(r.nama || "").trim(),
  angkatan: romanToInt(String(r.angkatan || "").trim()),
  registered: String(r.registered || "").trim().toUpperCase() === "Y",
})).filter((r) => r.nosis && r.angkatan > 0);
console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"}`);
console.log(`Total records: ${records.length} (registered Y: ${records.filter((r) => r.registered).length})\n`);

// Fetch all alumni (paginated)
const allAlumni = [];
for (let from = 0; ; from += 1000) {
  const { data } = await supabase.from("alumni").select("id, nosis, angkatan, nama").range(from, from + 999);
  if (!data || !data.length) break;
  allAlumni.push(...data);
  if (data.length < 1000) break;
}
const byNosis = new Map(allAlumni.map((a) => [a.nosis, a]));

// Match
const matched = [];
const unmatched = [];
for (const r of records) {
  const a = byNosis.get(r.nosis);
  if (a) matched.push({ ...r, alumni: a });
  else unmatched.push(r);
}
const dedup = new Map();
for (const m of matched) dedup.set(m.alumni.id, m);
const uniq = [...dedup.values()];
console.log(`Matched: ${matched.length} (unique alumni: ${uniq.length}) | unmatched: ${unmatched.length}`);

// Fetch members in batches
const memberByAlumni = new Map();
const ids = uniq.map((u) => u.alumni.id);
for (let i = 0; i < ids.length; i += 200) {
  const chunk = ids.slice(i, i + 200);
  const { data: members } = await supabase.from("members").select("id, alumni_id, isi_form_dpt, registrasi_website_dpt, status_dpt").in("alumni_id", chunk);
  for (const m of members || []) memberByAlumni.set(m.alumni_id, m);
}

const toUpdate = [], needCreateMember = [];
let alreadyDone = 0;
for (const u of uniq) {
  const ex = memberByAlumni.get(u.alumni.id);
  if (!ex) { needCreateMember.push(u); continue; }
  const patch = {};
  if (ex.isi_form_dpt !== "Sudah") patch.isi_form_dpt = "Sudah";
  if (u.registered) {
    if (ex.registrasi_website_dpt !== "Sudah") patch.registrasi_website_dpt = "Sudah";
    if (ex.status_dpt !== "Sudah") patch.status_dpt = "Sudah";
  }
  if (Object.keys(patch).length === 0) alreadyDone++;
  else toUpdate.push({ id: ex.id, patch });
}
console.log(`Plan: alreadyDone=${alreadyDone} update=${toUpdate.length} create-member=${needCreateMember.length} create-alumni=${unmatched.length}`);

if (!APPLY) { console.log("\n→ --apply"); process.exit(0); }

let updated = 0, createdMember = 0, createdAlumni = 0, createdMemberFromUnmatched = 0;

// Update existing members
for (const u of toUpdate) {
  const { error } = await supabase.from("members").update(u.patch).eq("id", u.id);
  if (!error) updated++;
}

// Get next member.no
const { data: maxRow } = await supabase.from("members").select("no").order("no", { ascending: false }).limit(1).single();
let nextNo = (maxRow.no ?? 0) + 1;

// Create members for matched-alumni-without-member
for (let i = 0; i < needCreateMember.length; i += 200) {
  const chunk = needCreateMember.slice(i, i + 200);
  const insertRows = chunk.map((u) => ({
    no: nextNo++, nama: u.alumni.nama, angkatan: u.alumni.angkatan, no_hp: "-", alumni_id: u.alumni.id,
    isi_form_dpt: "Sudah", sudah_dikontak: "Belum", masuk_grup: "Belum",
    registrasi_website_dpt: u.registered ? "Sudah" : "Belum",
    status_dpt: u.registered ? "Sudah" : null,
    vote: "Belum", dukungan: null,
  }));
  const { data, error } = await supabase.from("members").insert(insertRows).select("id");
  if (error) console.error(`create members chunk ${i}:`, error.message);
  else createdMember += data.length;
}

// Create alumni + members for unmatched NOSIS
for (let i = 0; i < unmatched.length; i += 100) {
  const chunk = unmatched.slice(i, i + 100);
  const alumniRows = chunk.map((u) => ({ nosis: u.nosis, nama: u.nama, angkatan: u.angkatan }));
  const { data: aData, error: aErr } = await supabase.from("alumni").insert(alumniRows).select("id, nosis");
  if (aErr) { console.error(`create alumni chunk ${i}:`, aErr.message); continue; }
  createdAlumni += aData.length;
  const memMap = new Map(aData.map((a) => [a.nosis, a]));
  const memRows = chunk.map((u) => {
    const a = memMap.get(u.nosis);
    if (!a) return null;
    return {
      no: nextNo++, nama: u.nama, angkatan: u.angkatan, no_hp: "-", alumni_id: a.id,
      isi_form_dpt: "Sudah", sudah_dikontak: "Belum", masuk_grup: "Belum",
      registrasi_website_dpt: u.registered ? "Sudah" : "Belum",
      status_dpt: u.registered ? "Sudah" : null,
      vote: "Belum", dukungan: null,
    };
  }).filter(Boolean);
  const { data: mData, error: mErr } = await supabase.from("members").insert(memRows).select("id");
  if (mErr) console.error(`create members for new alumni chunk ${i}:`, mErr.message);
  else createdMemberFromUnmatched += mData.length;
}

console.log(`\n→ Applied: updated=${updated}, member created=${createdMember}, alumni+member created=${createdAlumni}/${createdMemberFromUnmatched}`);
