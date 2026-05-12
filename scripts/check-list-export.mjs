import { readFileSync, writeFileSync } from "fs";
import XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function normName(s) {
  return String(s ?? "").toUpperCase().normalize("NFKD")
    .replace(/[‘’'`"?]/g, "")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ").trim();
}

const lines = readFileSync("/tmp/check-list.txt", "utf8").split("\n").map((l) => l.trim()).filter(Boolean);
const items = lines.map((l) => {
  const m = l.match(/^(.+?)\s+A(\d+)$/);
  if (!m) return null;
  return { rawName: m[1].trim(), angkatan: Number(m[2]) };
}).filter(Boolean);

const angList = [...new Set(items.map((i) => i.angkatan))];
const { data: alumni } = await supabase.from("alumni").select("id, nosis, nama, angkatan").in("angkatan", angList);

const angBuckets = new Map();
for (const a of alumni) {
  if (!angBuckets.has(a.angkatan)) angBuckets.set(a.angkatan, []);
  angBuckets.get(a.angkatan).push(a);
}

const ids = alumni.map((a) => a.id);
const memberByAlumni = new Map();
for (let i = 0; i < ids.length; i += 200) {
  const chunk = ids.slice(i, i + 200);
  const { data: members } = await supabase.from("members").select("id, alumni_id, isi_form_dpt, registrasi_website_dpt, status_dpt, dukungan, sudah_dikontak, no_hp").in("alumni_id", chunk);
  for (const m of members || []) memberByAlumni.set(m.alumni_id, m);
}

const out = [];
for (const item of items) {
  const ang = item.angkatan;
  const candidates = angBuckets.get(ang) || [];
  const queryTokens = normName(item.rawName).split(" ").filter(Boolean);
  let bestScore = 0, best = null, multiple = false;
  for (const a of candidates) {
    const aTokens = normName(a.nama).split(" ").filter(Boolean);
    let score = 0;
    for (const qt of queryTokens) {
      if (aTokens.some((at) => at === qt || (qt.length >= 4 && at.startsWith(qt)) || (qt.length >= 4 && qt.startsWith(at) && at.length >= 3))) score++;
    }
    if (score === 0) continue;
    if (score > bestScore) { bestScore = score; best = a; multiple = false; }
    else if (score === bestScore && bestScore >= queryTokens.length) multiple = true;
  }
  const minRequired = queryTokens.length >= 2 ? Math.min(2, queryTokens.length) : 1;
  const found = best && bestScore >= minRequired;
  const m = found ? memberByAlumni.get(best.id) : null;
  out.push({
    Angkatan: `TN${ang}`,
    "Input Nama": item.rawName,
    Match: found ? best.nama : "(NOT FOUND)",
    Ambigu: found && multiple ? "YA" : "",
    NOSIS: found ? best.nosis : "",
    "Form DPT": m?.isi_form_dpt || "",
    "Web DPT": m?.registrasi_website_dpt || "",
    "Status DPT": m?.status_dpt || "",
    Dukungan: m?.dukungan || "",
    "Sudah Dikontak": m?.sudah_dikontak || "",
    "No HP": m?.no_hp || "",
  });
}

// Summary per angkatan
const groups = {};
for (const r of out) {
  const k = r.Angkatan;
  if (!groups[k]) groups[k] = { total: 0, found: 0, dpt: 0, dukung: 0, notFound: 0 };
  groups[k].total++;
  if (r.Match === "(NOT FOUND)") groups[k].notFound++;
  else {
    groups[k].found++;
    if (r["Status DPT"] === "Sudah") groups[k].dpt++;
    if (r.Dukungan === "dukung" || r.Dukungan === "terkonvert") groups[k].dukung++;
  }
}

const summary = Object.entries(groups).map(([ang, s]) => ({
  Angkatan: ang,
  "Total Input": s.total,
  Match: s.found,
  "Tidak Match": s.notFound,
  "DPT Resmi": s.dpt,
  "Dukung": s.dukung,
}));

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), "Ringkasan");
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(out), "Detail");
const path = "/tmp/check-list-result.xlsx";
XLSX.writeFile(wb, path);

const totalDpt = out.filter((r) => r["Status DPT"] === "Sudah").length;
const totalDukung = out.filter((r) => r.Dukungan === "dukung" || r.Dukungan === "terkonvert").length;
const totalNotFound = out.filter((r) => r.Match === "(NOT FOUND)").length;
console.log(`\nTotal input: ${out.length}`);
console.log(`Match: ${out.length - totalNotFound} | Not found: ${totalNotFound}`);
console.log(`DPT Resmi: ${totalDpt} | Dukung: ${totalDukung}`);
console.log(`File: ${path}`);
