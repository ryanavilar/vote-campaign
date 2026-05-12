import { createClient } from "@supabase/supabase-js";
import XLSX from "xlsx";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const ANG = 17;

const { data: alumni } = await supabase.from("alumni").select("id, nosis, nama, angkatan").eq("angkatan", ANG).order("nosis");
const ids = alumni.map((a) => a.id);
const memberByAlumni = new Map();
for (let i = 0; i < ids.length; i += 200) {
  const chunk = ids.slice(i, i + 200);
  const { data: members } = await supabase.from("members").select("alumni_id, no_hp, sudah_dikontak, masuk_grup, isi_form_dpt, registrasi_website_dpt, status_dpt, dukungan, vote").in("alumni_id", chunk);
  for (const m of members || []) memberByAlumni.set(m.alumni_id, m);
}

const filtered = [];
for (const a of alumni) {
  const m = memberByAlumni.get(a.id);
  if (!m) continue;
  if (m.status_dpt !== "Sudah") continue;
  // Dukungan kosong ATAU ragu_ragu
  if (m.dukungan && m.dukungan !== "ragu_ragu") continue;
  filtered.push({
    NOSIS: a.nosis,
    Nama: a.nama,
    Angkatan: a.angkatan,
    "No HP": m.no_hp || "",
    "Sudah Dikontak": m.sudah_dikontak || "",
    Dukungan: m.dukungan === "ragu_ragu" ? "Ragu-ragu" : "(kosong)",
    "Masuk Grup": m.masuk_grup || "",
    "Form DPT": m.isi_form_dpt || "",
    "Web DPT": m.registrasi_website_dpt || "",
    "Status DPT": m.status_dpt || "",
    Vote: m.vote || "",
  });
}
filtered.forEach((r, i) => { r.No = i + 1; });
const ordered = filtered.map((r) => ({ No: r.No, ...r }));

console.log(`TN17 DPT terverifikasi dengan dukungan ragu/kosong: ${filtered.length}`);
console.log(`  ragu_ragu: ${filtered.filter((r) => r.Dukungan === "Ragu-ragu").length}`);
console.log(`  kosong: ${filtered.filter((r) => r.Dukungan === "(kosong)").length}`);

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet(ordered);
ws["!cols"] = [{ wch: 5 }, { wch: 9 }, { wch: 28 }, { wch: 5 }, { wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 11 }, { wch: 11 }, { wch: 11 }, { wch: 11 }, { wch: 8 }];
XLSX.utils.book_append_sheet(wb, ws, "TN17 Ragu Kosong");
const path = "/tmp/tn17-dpt-ragu-kosong.xlsx";
XLSX.writeFile(wb, path);
console.log("File:", path);
