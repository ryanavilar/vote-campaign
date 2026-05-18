import { createClient } from "@supabase/supabase-js";
import XLSX from "xlsx";
import fs from "fs";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split("\n").map((l) => {
    const m = l.match(/^([A-Z_]+)=(.*)$/);
    if (!m) return null;
    let v = m[2].replace(/^"|"$/g, "").replace(/\\n$/, "");
    return [m[1], v];
  }).filter(Boolean)
);
const s = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const wb = XLSX.readFile("/home/ubuntu/.claude/channels/telegram/inbox/1779082417991-AgADBh8AAvAUWVQ.xlsx");
const ws = wb.Sheets["COPY FORM"];
const rows = XLSX.utils.sheet_to_json(ws, { defval: "", header: 1 });
const header = rows[0];
const idxNama = header.indexOf("Nama Lengkap");
const idxNosis = header.indexOf("NOSIS");
const idxValid = header.indexOf("Validate");
const idxPilih = header.indexOf("Pilihan");
const idxVote = header.indexOf("Vote");

// Build update map by NOSIS
const updates = new Map();
const counts = { v1: 0, v2: 0, vTT: 0, skip: 0 };
for (let i = 1; i < rows.length; i++) {
  const r = rows[i];
  const nosis = String(r[idxNosis] || "").trim();
  if (!nosis) continue;
  const valid = String(r[idxValid] || "").trim();
  if (valid !== "Valid") { counts.skip++; continue; }
  const pilih = String(r[idxPilih] || "").trim();
  const vote = String(r[idxVote] || "").trim();
  let newVote = null;
  if (vote === "Sudah" && pilih === "1") newVote = "1";
  else if (vote === "Sudah" && pilih === "2") newVote = "2";
  else if (vote === "Sudah" && pilih === "") newVote = "TT";
  if (newVote) {
    updates.set(nosis, { nama: r[idxNama], newVote });
    if (newVote === "1") counts.v1++;
    else if (newVote === "2") counts.v2++;
    else if (newVote === "TT") counts.vTT++;
  }
}
console.log("Planned updates:", counts, "total:", updates.size);

// Pad NOSIS variants — try matching with leading zeros
function padN(n) {
  const clean = String(n).replace(/\D/g, "");
  return clean.padStart(6, "0");
}

// Fetch all TN15 members + alumni in one go
let mem = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await s
    .from("members")
    .select("id, nama, vote, alumni:alumni_id(nosis)")
    .eq("angkatan", 15)
    .range(from, from + 999);
  if (error) { console.error(error); process.exit(1); }
  if (!data?.length) break;
  mem = mem.concat(data);
  if (data.length < 1000) break;
}

const byNosis = new Map();
for (const m of mem) {
  const n = padN(m.alumni?.nosis || "");
  if (n) byNosis.set(n, m);
}

let updated = 0, missing = 0, sameAlready = 0;
const notFound = [];
for (const [nosisRaw, info] of updates) {
  const nosis = padN(nosisRaw);
  const m = byNosis.get(nosis);
  if (!m) { missing++; notFound.push(`${nosis} ${info.nama}`); continue; }
  if (m.vote === info.newVote) { sameAlready++; continue; }
  const { error } = await s.from("members").update({ vote: info.newVote }).eq("id", m.id);
  if (error) { console.error("ERR", info.nama, error.message); continue; }
  updated++;
}
console.log(`Updated: ${updated}, already same: ${sameAlready}, missing in members: ${missing}`);
if (notFound.length) {
  console.log("Not found NOSIS:");
  notFound.slice(0, 30).forEach((x) => console.log(" -", x));
  if (notFound.length > 30) console.log(` (+${notFound.length - 30} more)`);
}
