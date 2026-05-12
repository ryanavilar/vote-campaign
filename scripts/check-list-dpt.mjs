import { readFileSync } from "fs";
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

console.log(`Items to check: ${items.length}\n`);

// Fetch all alumni for relevant angkatan
const angList = [...new Set(items.map((i) => i.angkatan))];
const { data: alumni } = await supabase.from("alumni").select("id, nosis, nama, angkatan").in("angkatan", angList);

// Index by normalized name + angkatan tokens (substring match)
const angBuckets = new Map();
for (const a of alumni) {
  if (!angBuckets.has(a.angkatan)) angBuckets.set(a.angkatan, []);
  angBuckets.get(a.angkatan).push(a);
}

// Fetch members for those alumni
const ids = alumni.map((a) => a.id);
const memberByAlumni = new Map();
for (let i = 0; i < ids.length; i += 200) {
  const chunk = ids.slice(i, i + 200);
  const { data: members } = await supabase.from("members").select("id, alumni_id, isi_form_dpt, registrasi_website_dpt, status_dpt, dukungan, sudah_dikontak").in("alumni_id", chunk);
  for (const m of members || []) memberByAlumni.set(m.alumni_id, m);
}

// Match each item
const out = [];
for (const item of items) {
  const ang = item.angkatan;
  const candidates = angBuckets.get(ang) || [];
  const queryTokens = normName(item.rawName).split(" ").filter(Boolean);
  // Score: count of query tokens that appear in alumni name tokens
  let bestScore = 0;
  let best = null;
  let multiple = false;
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
  // Require at least full match of all query tokens (or 2 if 3+ tokens) for confidence
  const minRequired = queryTokens.length >= 2 ? Math.min(2, queryTokens.length) : 1;
  if (!best || bestScore < minRequired) {
    out.push({ ...item, found: false });
    continue;
  }
  const m = memberByAlumni.get(best.id);
  out.push({
    ...item, found: true, ambiguous: multiple,
    nama: best.nama, nosis: best.nosis,
    form: m?.isi_form_dpt || "-",
    web: m?.registrasi_website_dpt || "-",
    dpt: m?.status_dpt || "-",
    dukungan: m?.dukungan || "-",
    kontak: m?.sudah_dikontak || "-",
  });
}

// Group by angkatan for output
const groups = {};
for (const r of out) {
  if (!groups[r.angkatan]) groups[r.angkatan] = [];
  groups[r.angkatan].push(r);
}
for (const a of Object.keys(groups).sort((x, y) => x - y)) {
  console.log(`\n=== TN${a} ===`);
  for (const r of groups[a]) {
    if (!r.found) {
      console.log(`  ❌ ${r.rawName} → NOT FOUND`);
    } else {
      const tag = r.ambiguous ? " (multi)" : "";
      console.log(`  ${r.rawName}${tag} → ${r.nama} (${r.nosis})`);
      console.log(`     form=${r.form} web=${r.web} DPT=${r.dpt} dukung=${r.dukungan}`);
    }
  }
}

const summary = {
  total: out.length,
  found: out.filter((r) => r.found).length,
  notFound: out.filter((r) => !r.found).length,
  dpt: out.filter((r) => r.found && r.dpt === "Sudah").length,
  belumDpt: out.filter((r) => r.found && r.dpt !== "Sudah").length,
  dukung: out.filter((r) => r.found && (r.dukungan === "dukung" || r.dukungan === "terkonvert")).length,
};
console.log(`\n=== Summary ===`);
console.log(JSON.stringify(summary, null, 2));
