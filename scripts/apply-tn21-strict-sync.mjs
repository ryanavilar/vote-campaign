/**
 * TN21 strict sync per user instruction 2026-05-03:
 *   "data form dpt web dpt dan dpt mengikuti data ini ya jika ada yang di luar itu tolong jadikan belum saja"
 *
 *   isi_form_dpt: Sudah jika NOSIS ada di /tmp/tn21-form-nosis.txt, sebaliknya Belum
 *   registrasi_website_dpt + status_dpt: Sudah jika NOSIS ada di scripts/_tn21-web-dpt.txt, sebaliknya Belum/null
 *
 * Tidak mengubah dukungan, no_hp, dll. Hanya 3 kolom DPT funnel.
 * Berlaku ke semua member di angkatan 21 (linked ke alumni TN21).
 */
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const APPLY = process.argv.includes("--apply");
const ANG = 21;

const formSet = new Set(readFileSync("/tmp/tn21-form-nosis.txt", "utf8").split("\n").map((l) => l.trim()).filter(Boolean));
const webSet = new Set(readFileSync(`scripts/_tn${ANG}-web-dpt.txt`, "utf8").split("\n").map((l) => l.trim()).filter(Boolean));
console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"} | TN${ANG}`);
console.log(`Form NOSIS in source: ${formSet.size} | DPT NOSIS in source: ${webSet.size}\n`);

// Fetch all alumni TN21 + members
const { data: alumni } = await supabase.from("alumni").select("id, nosis, nama").eq("angkatan", ANG);
const byAlumniId = new Map(alumni.map((a) => [a.id, a]));
const { data: members } = await supabase.from("members").select("id, alumni_id, nama, isi_form_dpt, registrasi_website_dpt, status_dpt").eq("angkatan", ANG);

const updates = [];
let already = 0;
for (const m of members) {
  const a = byAlumniId.get(m.alumni_id);
  if (!a) continue;
  const targetForm = formSet.has(a.nosis) ? "Sudah" : "Belum";
  const targetWeb = webSet.has(a.nosis) ? "Sudah" : "Belum";
  const targetStatus = webSet.has(a.nosis) ? "Sudah" : null;
  const patch = {};
  if (m.isi_form_dpt !== targetForm) patch.isi_form_dpt = targetForm;
  if (m.registrasi_website_dpt !== targetWeb) patch.registrasi_website_dpt = targetWeb;
  if (m.status_dpt !== targetStatus) patch.status_dpt = targetStatus;
  if (Object.keys(patch).length === 0) already++;
  else updates.push({ id: m.id, nama: a.nama, nosis: a.nosis, patch, current: { f: m.isi_form_dpt, w: m.registrasi_website_dpt, s: m.status_dpt } });
}

// Also create members for alumni that are in form/web set but no member yet
const haveMember = new Set(members.map((m) => m.alumni_id));
const toCreate = [];
for (const a of alumni) {
  if (haveMember.has(a.id)) continue;
  const inForm = formSet.has(a.nosis);
  const inWeb = webSet.has(a.nosis);
  if (!inForm && !inWeb) continue;
  toCreate.push({ alumni: a, form: inForm, web: inWeb });
}

const flipsToBelumForm = updates.filter((u) => u.patch.isi_form_dpt === "Belum").length;
const flipsToSudahForm = updates.filter((u) => u.patch.isi_form_dpt === "Sudah").length;
const flipsToBelumWeb = updates.filter((u) => u.patch.registrasi_website_dpt === "Belum").length;
const flipsToSudahWeb = updates.filter((u) => u.patch.registrasi_website_dpt === "Sudah").length;
console.log(`Members existing: ${members.length}, alreadyMatching: ${already}, updates: ${updates.length}, create: ${toCreate.length}`);
console.log(`  Form: ${flipsToSudahForm} → Sudah, ${flipsToBelumForm} → Belum`);
console.log(`  Web/DPT: ${flipsToSudahWeb} → Sudah, ${flipsToBelumWeb} → Belum`);

if (!APPLY) { console.log("\n→ --apply"); process.exit(0); }

let updated = 0, created = 0;
for (const u of updates) {
  const { error } = await supabase.from("members").update(u.patch).eq("id", u.id);
  if (!error) updated++;
}
if (toCreate.length) {
  const { data: maxRow } = await supabase.from("members").select("no").order("no", { ascending: false }).limit(1).single();
  let no = (maxRow.no ?? 0) + 1;
  const rows = toCreate.map((c) => ({
    no: no++, nama: c.alumni.nama, angkatan: ANG, no_hp: "-", alumni_id: c.alumni.id,
    isi_form_dpt: c.form ? "Sudah" : "Belum", sudah_dikontak: "Belum", masuk_grup: "Belum",
    registrasi_website_dpt: c.web ? "Sudah" : "Belum",
    status_dpt: c.web ? "Sudah" : null,
    vote: "Belum", dukungan: null,
  }));
  const { data, error } = await supabase.from("members").insert(rows).select("id");
  if (error) console.error("create error:", error.message);
  else created = data.length;
}
console.log(`\n→ updated=${updated}, created=${created}`);
