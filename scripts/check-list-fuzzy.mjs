import { readFileSync } from "fs";
import XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function normName(s) {
  return String(s ?? "").toUpperCase().normalize("NFKD")
    .replace(/[‘’'`"?]/g, "")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ").trim();
}

// Levenshtein distance
function lev(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (m === 0) return n; if (n === 0) return m;
  const v0 = new Array(n + 1).fill(0);
  const v1 = new Array(n + 1).fill(0);
  for (let i = 0; i <= n; i++) v0[i] = i;
  for (let i = 0; i < m; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < n; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
    }
    for (let j = 0; j <= n; j++) v0[j] = v1[j];
  }
  return v0[n];
}

// Token similarity: best alignment between query tokens and name tokens
// Each query token contributes max sim with any name token (Jaccard-like avg)
function tokenSim(query, name) {
  const qt = query.split(" ").filter(Boolean);
  const nt = name.split(" ").filter(Boolean);
  if (!qt.length || !nt.length) return 0;
  let totalScore = 0;
  for (const q of qt) {
    let best = 0;
    for (const n of nt) {
      // exact match = 1.0
      if (q === n) { best = 1.0; break; }
      // initial-letter shortcut for 1-2 char query tokens (e.g. "W" matches "Wijayanto")
      if (q.length <= 2 && n.startsWith(q)) best = Math.max(best, 0.8);
      // prefix match (>=3) = 0.85
      else if (q.length >= 3 && n.startsWith(q)) best = Math.max(best, 0.85);
      else if (n.length >= 3 && q.startsWith(n)) best = Math.max(best, 0.85);
      // substring (>=4) = 0.7
      else if (q.length >= 4 && n.includes(q)) best = Math.max(best, 0.7);
      else if (n.length >= 4 && q.includes(n)) best = Math.max(best, 0.7);
      // levenshtein-based for typos (token-level)
      else {
        const maxLen = Math.max(q.length, n.length);
        if (maxLen >= 4) {
          const d = lev(q, n);
          const sim = 1 - d / maxLen;
          if (sim >= 0.7) best = Math.max(best, sim * 0.9); // tone down vs exact
        }
      }
    }
    totalScore += best;
  }
  return totalScore / qt.length;
}

const INPUT = process.env.LIST_INPUT || "/tmp/check-list.txt";
const OUTPUT = process.env.LIST_OUTPUT || "/tmp/check-list-automatch.xlsx";
const lines = readFileSync(INPUT, "utf8").split("\n").map((l) => l.trim()).filter(Boolean);
const items = lines.map((l) => {
  const m = l.match(/^(.+?)\s+A(\d+)$/);
  if (!m) return null;
  return { rawName: m[1].trim(), angkatan: Number(m[2]) };
}).filter(Boolean);

const angList = [...new Set(items.map((i) => i.angkatan))];
const alumni = [];
for (let from = 0; ; from += 1000) {
  const { data } = await supabase.from("alumni").select("id, nosis, nama, angkatan").in("angkatan", angList).range(from, from + 999);
  if (!data || !data.length) break;
  alumni.push(...data);
  if (data.length < 1000) break;
}

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
  const q = normName(item.rawName);
  let bestSim = 0, best = null, secondSim = 0;
  for (const a of candidates) {
    const sim = tokenSim(q, normName(a.nama));
    if (sim > bestSim) { secondSim = bestSim; bestSim = sim; best = a; }
    else if (sim > secondSim) secondSim = sim;
  }
  // Auto-match: take the best candidate as long as it has any reasonable similarity
  const found = best && bestSim >= 0.4;
  const ambiguous = found && secondSim > 0 && (bestSim - secondSim) < 0.1;
  const m = found ? memberByAlumni.get(best.id) : null;
  out.push({
    Angkatan: `TN${ang}`,
    "Input Nama": item.rawName,
    Match: found ? best.nama : "(NOT FOUND)",
    Confidence: found ? bestSim.toFixed(2) : "",
    Ambigu: ambiguous ? "YA" : "",
    NOSIS: found ? best.nosis : "",
    "Form DPT": m?.isi_form_dpt || "",
    "Web DPT": m?.registrasi_website_dpt || "",
    "Status DPT": m?.status_dpt || "",
    Dukungan: m?.dukungan || "",
    "Sudah Dikontak": m?.sudah_dikontak || "",
    "No HP": m?.no_hp || "",
  });
}

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
XLSX.writeFile(wb, OUTPUT);

const totalDpt = out.filter((r) => r["Status DPT"] === "Sudah").length;
const totalDukung = out.filter((r) => r.Dukungan === "dukung" || r.Dukungan === "terkonvert").length;
const totalNotFound = out.filter((r) => r.Match === "(NOT FOUND)").length;
console.log(`Input: ${out.length} | Match: ${out.length - totalNotFound} | Not found: ${totalNotFound}`);
console.log(`DPT: ${totalDpt} | Dukung: ${totalDukung}`);
console.log(`File: ${OUTPUT}`);
