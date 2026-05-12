import { createClient } from "@supabase/supabase-js";
import XLSX from "xlsx";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const ANG = Number(process.env.ANG || 9);

const { data: alumni } = await supabase.from("alumni").select("id, nosis, nama, angkatan, keterangan").eq("angkatan", ANG).order("nosis");
const ids = alumni.map((a) => a.id);
const memberByAlumni = new Map();
for (let i = 0; i < ids.length; i += 200) {
  const chunk = ids.slice(i, i + 200);
  const { data: members } = await supabase.from("members").select("alumni_id, no_hp, sudah_dikontak, masuk_grup, isi_form_dpt, registrasi_website_dpt, status_dpt, dukungan, vote").in("alumni_id", chunk);
  for (const m of members || []) memberByAlumni.set(m.alumni_id, m);
}

const dukunganLabel = { dukung: "Dukung", ragu_ragu: "Ragu-ragu", milih_sebelah: "Sebelah", terkonvert: "Convert" };
const filtered = [];
for (const a of alumni) {
  const m = memberByAlumni.get(a.id);
  if (!m || m.status_dpt !== "Sudah") continue;
  filtered.push({
    NOSIS: a.nosis, Nama: a.nama, Angkatan: a.angkatan,
    Keterangan: a.keterangan || "",
    "No HP": m.no_hp || "",
    "Sudah Dikontak": m.sudah_dikontak || "",
    Dukungan: m.dukungan ? (dukunganLabel[m.dukungan] || m.dukungan) : "",
    "Masuk Grup": m.masuk_grup || "",
    "Form DPT": m.isi_form_dpt || "",
    "Web DPT": m.registrasi_website_dpt || "",
    "Status DPT": m.status_dpt || "",
    Vote: m.vote || "",
  });
}
const ordered = filtered.map((r, i) => ({ No: i + 1, ...r }));

console.log(`TN${ANG} sudah DPT terverifikasi: ${filtered.length}`);

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet(ordered);
ws["!cols"] = [{ wch: 5 }, { wch: 9 }, { wch: 28 }, { wch: 5 }, { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 11 }, { wch: 11 }, { wch: 11 }, { wch: 11 }, { wch: 8 }];
XLSX.utils.book_append_sheet(wb, ws, `TN${ANG} DPT`);
const path = `/tmp/data-tn${ANG}-dpt.xlsx`;
XLSX.writeFile(wb, path);
console.log("File:", path);
