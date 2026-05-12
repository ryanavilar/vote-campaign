import { createClient } from "@supabase/supabase-js";
import XLSX from "xlsx";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Panitia official data per 30 April 2026 09:45 WIB (read from image)
const panitia = {
  1:  { alumni: 264, gform: 177, web: 120, dpt: 120 },
  2:  { alumni: 232, gform:  78, web:  35, dpt:  31 },
  3:  { alumni: 235, gform: 184, web: 159, dpt: 156 },
  4:  { alumni: 241, gform: 126, web:  97, dpt:  94 },
  5:  { alumni: 242, gform:  97, web:  63, dpt:  61 },
  6:  { alumni: 232, gform: 142, web: 115, dpt: 110 },
  7:  { alumni: 303, gform: 285, web: 278, dpt: 278 },
  8:  { alumni: 296, gform: 125, web: 110, dpt: 110 },
  9:  { alumni: 294, gform: 107, web:  62, dpt:  59 },
  10: { alumni: 292, gform: 178, web: 120, dpt: 115 },
  11: { alumni: 295, gform: 102, web:  73, dpt:  59 },
  12: { alumni: 201, gform: 137, web: 101, dpt:  94 },
  13: { alumni: 290, gform: 254, web: 224, dpt: 223 },
  14: { alumni: 339, gform:  84, web:  42, dpt:  42 },
  15: { alumni: 289, gform: 206, web: 143, dpt: 142 },
  16: { alumni: 320, gform: 167, web:  76, dpt:  69 },
  17: { alumni: 305, gform: 190, web: 130, dpt: 128 },
  18: { alumni: 286, gform: 142, web: 122, dpt: 122 },
  19: { alumni: 289, gform: 206, web: 157, dpt: 151 },
  20: { alumni: 301, gform: 171, web: 121, dpt: 114 },
  21: { alumni: 298, gform: 170, web:  94, dpt:  93 },
  22: { alumni: 310, gform: 138, web:  84, dpt:  82 },
  23: { alumni: 336, gform: 216, web: 177, dpt: 161 },
  24: { alumni: 334, gform: 138, web:  56, dpt:  45 },
  25: { alumni: 361, gform:  38, web:  33, dpt:  31 },
  26: { alumni: 363, gform: 112, web:  45, dpt:  44 },
  27: { alumni: 358, gform:  75, web:  33, dpt:  30 },
  28: { alumni: 372, gform:  86, web:  50, dpt:  45 },
  29: { alumni: 359, gform:  91, web:  47, dpt:  45 },
  30: { alumni: 410, gform:  90, web:  24, dpt:  24 },
  31: { alumni: 381, gform: 246, web:  91, dpt:  70 },
  32: { alumni: 340, gform: 139, web:  46, dpt:  42 },
  33: { alumni: 315, gform: 179, web:  74, dpt:  71 },
};

// Fetch our data per angkatan
async function fetchAll() {
  // Alumni count per angkatan (paginated)
  const alumniByAng = {};
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase.from("alumni").select("angkatan").range(from, from + 999);
    if (!data || !data.length) break;
    for (const a of data) alumniByAng[a.angkatan] = (alumniByAng[a.angkatan] || 0) + 1;
    if (data.length < 1000) break;
  }

  // Members aggregates per angkatan
  let allMembers = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase.from("members")
      .select("angkatan, isi_form_dpt, registrasi_website_dpt, status_dpt, dukungan")
      .range(from, from + 999);
    if (!data || !data.length) break;
    allMembers = allMembers.concat(data);
    if (data.length < 1000) break;
  }
  const stats = {};
  for (const m of allMembers) {
    const k = m.angkatan;
    if (!stats[k]) stats[k] = { gform: 0, web: 0, dpt: 0, dukung: 0, dptDukung: 0 };
    if (m.isi_form_dpt === "Sudah") stats[k].gform++;
    if (m.registrasi_website_dpt === "Sudah") stats[k].web++;
    if (m.status_dpt === "Sudah") stats[k].dpt++;
    const isDukung = m.dukungan === "dukung" || m.dukungan === "terkonvert";
    if (isDukung) stats[k].dukung++;
    if (isDukung && m.status_dpt === "Sudah") stats[k].dptDukung++;
  }
  return { alumniByAng, stats };
}

const { alumniByAng, stats } = await fetchAll();

// Build comparison rows
const rows = [];
for (let ang = 1; ang <= 33; ang++) {
  const p = panitia[ang] || {};
  const o = stats[ang] || {};
  const ourAlumni = alumniByAng[ang] || 0;
  rows.push({
    Angkatan: `TN ${ang}`,
    "Alumni (Kita)": ourAlumni,
    "Alumni (Panitia)": p.alumni || 0,
    "Δ Alumni": ourAlumni - (p.alumni || 0),
    "GForm (Kita)": o.gform || 0,
    "GForm (Panitia)": p.gform || 0,
    "Δ GForm": (o.gform || 0) - (p.gform || 0),
    "Web (Kita)": o.web || 0,
    "Web (Panitia)": p.web || 0,
    "Δ Web": (o.web || 0) - (p.web || 0),
    "DPT (Kita)": o.dpt || 0,
    "DPT (Panitia)": p.dpt || 0,
    "Δ DPT": (o.dpt || 0) - (p.dpt || 0),
    "Dukung (Kita)": o.dukung || 0,
    "DPT+Dukung (Kita)": o.dptDukung || 0,
    "% DPT (Kita)": ourAlumni ? Math.round((o.dpt || 0) / ourAlumni * 10000) / 100 : 0,
    "% DPT (Panitia)": p.alumni ? Math.round((p.dpt || 0) / p.alumni * 10000) / 100 : 0,
    "% Dukung dari DPT": (o.dpt || 0) ? Math.round((o.dptDukung || 0) / (o.dpt || 0) * 10000) / 100 : 0,
  });
}

// Total — sum data rows only (before push)
const dataOnly = [...rows];
const sum = (key) => dataOnly.reduce((s, r) => s + (r[key] || 0), 0);
rows.push({
  Angkatan: "TOTAL",
  "Alumni (Kita)": sum("Alumni (Kita)"),
  "Alumni (Panitia)": sum("Alumni (Panitia)"),
  "Δ Alumni": sum("Δ Alumni"),
  "GForm (Kita)": sum("GForm (Kita)"),
  "GForm (Panitia)": sum("GForm (Panitia)"),
  "Δ GForm": sum("Δ GForm"),
  "Web (Kita)": sum("Web (Kita)"),
  "Web (Panitia)": sum("Web (Panitia)"),
  "Δ Web": sum("Δ Web"),
  "DPT (Kita)": sum("DPT (Kita)"),
  "DPT (Panitia)": sum("DPT (Panitia)"),
  "Δ DPT": sum("Δ DPT"),
  "Dukung (Kita)": sum("Dukung (Kita)"),
  "DPT+Dukung (Kita)": sum("DPT+Dukung (Kita)"),
  "% DPT (Kita)": Math.round(sum("DPT (Kita)") / sum("Alumni (Kita)") * 10000) / 100,
  "% DPT (Panitia)": Math.round(sum("DPT (Panitia)") / sum("Alumni (Panitia)") * 10000) / 100,
  "% Dukung dari DPT": sum("DPT (Kita)") ? Math.round(sum("DPT+Dukung (Kita)") / sum("DPT (Kita)") * 10000) / 100 : 0,
});

// Build summary sheet
const summary = [
  { Metric: "Alumni Aktif", Kita: sum("Alumni (Kita)"), Panitia: sum("Alumni (Panitia)"), Selisih: sum("Δ Alumni") },
  { Metric: "Tervalidasi GForm", Kita: sum("GForm (Kita)"), Panitia: sum("GForm (Panitia)"), Selisih: sum("Δ GForm") },
  { Metric: "Terdaftar Website", Kita: sum("Web (Kita)"), Panitia: sum("Web (Panitia)"), Selisih: sum("Δ Web") },
  { Metric: "DPT Valid", Kita: sum("DPT (Kita)"), Panitia: sum("DPT (Panitia)"), Selisih: sum("Δ DPT") },
  { Metric: "Dukung (Pendukung Kita)", Kita: sum("Dukung (Kita)"), Panitia: "-", Selisih: "-" },
  { Metric: "DPT + Dukung (Pendukung Sah)", Kita: sum("DPT+Dukung (Kita)"), Panitia: "-", Selisih: "-" },
];

// Discrepancy ranking — top 10 angkatan with biggest absolute Δ DPT
const dataRows = rows.filter((r) => r.Angkatan !== "TOTAL");
const ranked = [...dataRows].sort((a, b) => Math.abs(b["Δ DPT"]) - Math.abs(a["Δ DPT"])).slice(0, 15);
const rankedOut = ranked.map((r) => ({
  Angkatan: r.Angkatan,
  "DPT Kita": r["DPT (Kita)"],
  "DPT Panitia": r["DPT (Panitia)"],
  "Δ DPT": r["Δ DPT"],
  "% Kita": r["% DPT (Kita)"],
  "% Panitia": r["% DPT (Panitia)"],
}));

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), "Ringkasan");
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Per Angkatan");
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rankedOut), "Top 15 Selisih DPT");
const out = "/tmp/discrepancy-2026-05-01-v2.xlsx";
XLSX.writeFile(wb, out);
console.log("written:", out);
console.log("Summary:", summary);
