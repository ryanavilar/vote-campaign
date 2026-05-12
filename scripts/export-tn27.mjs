import { createClient } from "@supabase/supabase-js";
import XLSX from "xlsx";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const ANG = 27;

const { data: alumni } = await supabase.from("alumni").select("id, nosis, nama, angkatan, keterangan").eq("angkatan", ANG).order("nosis");
const ids = alumni.map((a) => a.id);
const memberByAlumni = new Map();
for (let i = 0; i < ids.length; i += 200) {
  const chunk = ids.slice(i, i + 200);
  const { data: members } = await supabase.from("members").select("alumni_id, no_hp, sudah_dikontak, masuk_grup, isi_form_dpt, registrasi_website_dpt, status_dpt, dukungan, vote").in("alumni_id", chunk);
  for (const m of members || []) memberByAlumni.set(m.alumni_id, m);
}

const dukunganLabel = { dukung: "Dukung", ragu_ragu: "Ragu-ragu", milih_sebelah: "Sebelah", terkonvert: "Convert" };
const rows = alumni.map((a, i) => {
  const m = memberByAlumni.get(a.id);
  return {
    No: i + 1,
    NOSIS: a.nosis,
    Nama: a.nama,
    Angkatan: a.angkatan,
    Keterangan: a.keterangan || "",
    "No HP": m?.no_hp || "",
    "Sudah Dikontak": m?.sudah_dikontak || "",
    Dukungan: m?.dukungan ? (dukunganLabel[m.dukungan] || m.dukungan) : "",
    "Masuk Grup WA": m?.masuk_grup || "",
    "Form DPT": m?.isi_form_dpt || "",
    "Web DPT": m?.registrasi_website_dpt || "",
    "Status DPT": m?.status_dpt || "",
    Vote: m?.vote || "",
  };
});

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet(rows);
ws["!cols"] = [
  { wch: 5 }, { wch: 9 }, { wch: 28 }, { wch: 5 }, { wch: 20 },
  { wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 11 },
  { wch: 11 }, { wch: 11 }, { wch: 8 },
];
XLSX.utils.book_append_sheet(wb, ws, `TN${ANG}`);
const path = `/tmp/data-tn${ANG}.xlsx`;
XLSX.writeFile(wb, path);
console.log("Total alumni TN" + ANG + ":", alumni.length);
console.log("With member row:", rows.filter((r) => r["Form DPT"] || r["Status DPT"]).length);
console.log("File:", path);
