/**
 * TN20: set dukungan based on highlight color in PDF
 *   green highlight → dukungan="dukung"
 *   orange highlight → dukungan="ragu_ragu"
 *   no highlight → leave alone
 * Source: /tmp/tn20-extracted.json (extracted by /tmp/tn20-extract.mjs)
 */
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const APPLY = process.argv.includes("--apply");
const ANG = 20;
const extracted = JSON.parse(readFileSync("/tmp/tn20-extracted.json", "utf8"));
const targets = extracted.filter((r) => r.dukungan);
console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"}`);
console.log(`PDF rows: ${extracted.length}, with highlight: ${targets.length} (dukung=${targets.filter(t=>t.dukungan==='dukung').length}, ragu=${targets.filter(t=>t.dukungan==='ragu_ragu').length})\n`);

const list = [...new Set(targets.map((t) => t.nosis))];
const { data: alumni } = await supabase.from("alumni").select("id, nosis, nama, angkatan").eq("angkatan", ANG).in("nosis", list);
const alumniByNosis = new Map(alumni.map((a) => [a.nosis, a]));
const { data: members } = await supabase
  .from("members").select("id, alumni_id, nama, dukungan").in("alumni_id", alumni.map((a) => a.id));
const byAl = new Map(members.map((m) => [m.alumni_id, m]));

const updates = [];
const noMember = [];
const noChange = [];
for (const t of targets) {
  const a = alumniByNosis.get(t.nosis);
  if (!a) continue;
  const m = byAl.get(a.id);
  if (!m) { noMember.push(t.nosis); continue; }
  if (m.dukungan === t.dukungan) noChange.push(t.nosis);
  else updates.push({ memberId: m.id, nama: a.nama, from: m.dukungan, to: t.dukungan });
}
console.log(`Will update: ${updates.length} | already correct: ${noChange.length} | no member row: ${noMember.length}`);
if (noMember.length) console.log(`  no member: ${noMember.join(", ")}`);

console.log("\nSample updates:");
updates.slice(0, 8).forEach((u) => console.log(`  ${u.nama}: ${u.from || '-'} → ${u.to}`));

if (!APPLY) { console.log("\n→ --apply"); process.exit(0); }

let ok = 0;
for (const u of updates) {
  const { error } = await supabase.from("members").update({ dukungan: u.to }).eq("id", u.memberId);
  if (error) console.error(`  ❌ ${u.nama}:`, error.message);
  else ok++;
}
console.log(`\n→ Applied: ${ok}`);
