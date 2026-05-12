/**
 * 2026-04-24 part 3: TN26 + TN32 form DPT ingestion
 *   (TN26 web DPT handled by apply-web-dpt-by-list.mjs 26 scripts/_tn26-web-dpt.txt)
 *   TN32 web DPT PDF kosong, tidak ada yang diproses.
 */
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const APPLY = process.argv.includes("--apply");

const sources = [
  { ang: 26, records: JSON.parse(readFileSync("/tmp/tn26-form-records.json", "utf8")) },
  { ang: 32, records: JSON.parse(readFileSync("/tmp/tn32-form-records.json", "utf8")) },
];

console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"}`);
for (const s of sources) console.log(`TN${s.ang} records: ${s.records.length}`);
console.log();

async function processAng(ang, records) {
  const { data: alumni } = await supabase
    .from("alumni").select("id, nosis, nama, angkatan").eq("angkatan", ang);
  const byNosis = new Map(alumni.map((a) => [String(a.nosis), a]));
  const matched = [];
  const unmatched = [];
  for (const rec of records) {
    const a = byNosis.get(String(rec.nosis));
    if (a) matched.push({ alumni: a, phone: rec.phone });
    else unmatched.push(rec.nosis);
  }
  const seen = new Set();
  const uniq = matched.filter((m) => seen.has(m.alumni.id) ? false : seen.add(m.alumni.id));
  const ids = uniq.map((m) => m.alumni.id);
  const { data: members } = await supabase
    .from("members").select("id, alumni_id, nama, isi_form_dpt, no_hp").in("alumni_id", ids);
  const byAl = new Map(members.map((m) => [m.alumni_id, m]));
  const toFlip = [], alreadySudah = [], needCreate = [];
  for (const m of uniq) {
    const ex = byAl.get(m.alumni.id);
    if (!ex) needCreate.push(m);
    else if (ex.isi_form_dpt === "Sudah") alreadySudah.push(ex);
    else toFlip.push(ex);
  }
  console.log(`TN${ang}: match=${matched.length}/${records.length} unmatched=${unmatched.length} | flip=${toFlip.length} already=${alreadySudah.length} create=${needCreate.length}`);
  if (unmatched.length) console.log(`  unmatched NOSIS: ${unmatched.join(", ")}`);
  return { toFlip, needCreate };
}

const results = [];
for (const s of sources) results.push(await processAng(s.ang, s.records));

if (!APPLY) { console.log("\n→ --apply to write"); process.exit(0); }

const needCreateAll = results.flatMap((r) => r.needCreate);
const toFlipAll = results.flatMap((r) => r.toFlip);
let created = 0, flipped = 0, errs = 0;

if (needCreateAll.length) {
  const { data: maxRow } = await supabase.from("members").select("no").order("no", { ascending: false }).limit(1).single();
  let nextNo = (maxRow.no ?? 0) + 1;
  const rows = needCreateAll.map((m) => ({
    no: nextNo++,
    nama: m.alumni.nama,
    angkatan: m.alumni.angkatan,
    no_hp: m.phone || "-",
    alumni_id: m.alumni.id,
    isi_form_dpt: "Sudah",
    sudah_dikontak: "Belum",
    masuk_grup: "Belum",
    registrasi_website_dpt: "Belum",
    status_dpt: null,
    vote: "Belum",
    dukungan: null,
  }));
  const { data, error } = await supabase.from("members").insert(rows).select("id");
  if (error) console.error("create error:", error.message);
  else created = data.length;
}
for (const m of toFlipAll) {
  const { error } = await supabase.from("members").update({ isi_form_dpt: "Sudah" }).eq("id", m.id);
  if (error) { errs++; console.error(`  ❌ ${m.nama}: ${error.message}`); }
  else flipped++;
}
console.log(`\n→ created=${created}, flipped=${flipped}, errors=${errs}`);
