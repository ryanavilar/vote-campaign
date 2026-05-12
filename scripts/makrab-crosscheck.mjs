import { readFileSync } from "fs";
import XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function nn(s) { const d = String(s ?? "").replace(/\D+/g, ""); return d ? (d.length < 6 ? d.padStart(6, "0") : d) : ""; }

const wb = XLSX.readFile("/home/ubuntu/.claude/channels/telegram/inbox/1777683553166-AgADkB0AAoMssFc.xlsx");
const rows = XLSX.utils.sheet_to_json(wb.Sheets["Form Responses 1"], { defval: "" });
const attendees = rows.map((r) => ({
  nama: String(r["Nama Lengkap"] || "").trim(),
  nosis: nn(r.NIS),
  angkatan: r.Angkatan,
})).filter((a) => a.nosis);

console.log(`Total attendees from xlsx: ${rows.length}, with NOSIS: ${attendees.length}`);

const nosisList = [...new Set(attendees.map((a) => a.nosis))];
console.log(`Unique NOSIS: ${nosisList.length}`);

// Fetch alumni for these
const { data: alumni } = await supabase.from("alumni").select("id, nosis, nama, angkatan").in("nosis", nosisList);
const alumniByNosis = new Map(alumni.map((a) => [a.nosis, a]));
const unmatched = nosisList.filter((n) => !alumniByNosis.has(n));
console.log(`Alumni matched: ${alumni.length}/${nosisList.length}, unmatched NOSIS: ${unmatched.length}`);

// Fetch members for matched alumni
const { data: members } = await supabase.from("members").select("alumni_id, dukungan, status_dpt, isi_form_dpt, registrasi_website_dpt").in("alumni_id", alumni.map((a) => a.id));
const memberByAlumni = new Map(members.map((m) => [m.alumni_id, m]));

let belumDukung = [], belumDpt = [], belumKeduanya = [], lengkap = [], tanpaMember = [];

for (const att of attendees) {
  const a = alumniByNosis.get(att.nosis);
  if (!a) continue;
  const m = memberByAlumni.get(a.id);
  if (!m) {
    tanpaMember.push({ ...att, alumniNama: a.nama });
    continue;
  }
  const isDukung = m.dukungan === "dukung" || m.dukungan === "terkonvert";
  const isDpt = m.status_dpt === "Sudah";
  const row = { ...att, alumniNama: a.nama, dukungan: m.dukungan || "-", form_dpt: m.isi_form_dpt || "-", web_dpt: m.registrasi_website_dpt || "-", status_dpt: m.status_dpt || "-" };
  if (!isDukung && !isDpt) belumKeduanya.push(row);
  else if (!isDukung) belumDukung.push(row);
  else if (!isDpt) belumDpt.push(row);
  else lengkap.push(row);
}

console.log(`\nKategori (dari ${attendees.length} attendees):`);
console.log(`  ✅ Lengkap (dukung + DPT):    ${lengkap.length}`);
console.log(`  🔴 Belum DPT & belum Dukung:  ${belumKeduanya.length}`);
console.log(`  🟡 Sudah Dukung tapi Belum DPT: ${belumDpt.length}`);
console.log(`  🟠 Sudah DPT tapi Belum Dukung: ${belumDukung.length}`);
console.log(`  ⚠️  Tanpa member row:           ${tanpaMember.length}`);
console.log(`  ❓ NOSIS unmatched:            ${unmatched.length}`);

// Build xlsx output
const wb2 = XLSX.utils.book_new();
const summary = [
  { Kategori: "Total attendees", Jumlah: attendees.length },
  { Kategori: "✅ Lengkap (dukung + DPT)", Jumlah: lengkap.length },
  { Kategori: "🔴 Belum keduanya (prioritas tertinggi)", Jumlah: belumKeduanya.length },
  { Kategori: "🟡 Sudah dukung, belum DPT", Jumlah: belumDpt.length },
  { Kategori: "🟠 Sudah DPT, belum dukung", Jumlah: belumDukung.length },
  { Kategori: "⚠️ Tanpa member row", Jumlah: tanpaMember.length },
  { Kategori: "❓ NOSIS tidak match alumni", Jumlah: unmatched.length },
];
XLSX.utils.book_append_sheet(wb2, XLSX.utils.json_to_sheet(summary), "Ringkasan");
XLSX.utils.book_append_sheet(wb2, XLSX.utils.json_to_sheet(belumKeduanya), "Belum Keduanya");
XLSX.utils.book_append_sheet(wb2, XLSX.utils.json_to_sheet(belumDpt), "Sudah Dukung Belum DPT");
XLSX.utils.book_append_sheet(wb2, XLSX.utils.json_to_sheet(belumDukung), "Sudah DPT Belum Dukung");
XLSX.utils.book_append_sheet(wb2, XLSX.utils.json_to_sheet(tanpaMember), "Tanpa Member Row");
XLSX.utils.book_append_sheet(wb2, XLSX.utils.json_to_sheet(lengkap), "Lengkap");
const out = "/tmp/makrab-crosscheck.xlsx";
XLSX.writeFile(wb2, out);
console.log("\n→ written:", out);
