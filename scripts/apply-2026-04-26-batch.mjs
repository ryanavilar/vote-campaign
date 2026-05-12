/**
 * 2026-04-26 batch:
 *   Form DPT (isi_form_dpt=Sudah, create member if missing): TN17, TN18, TN23, TN31
 *   Web DPT (status_dpt=Sudah, registrasi_website_dpt=Sudah, create with all 3 flags Sudah if no member): TN17, TN18, TN19, TN23, TN31
 *
 * Order matters: process form first (creates members from form data), then web.
 */
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const APPLY = process.argv.includes("--apply");

const formAng = [17, 18, 23, 31];
const webAng = [17, 18, 19, 23, 31];
console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"}\n`);

let nextNo = null;
async function getNextNo() {
  if (nextNo === null) {
    const { data } = await supabase.from("members").select("no").order("no", { ascending: false }).limit(1).single();
    nextNo = (data.no ?? 0) + 1;
  }
  return nextNo;
}

async function processForm(ang) {
  const records = JSON.parse(readFileSync(`/tmp/tn${ang}-form-records.json`, "utf8"));
  const { data: alumni } = await supabase
    .from("alumni").select("id, nosis, nama, angkatan").eq("angkatan", ang);
  const byNosis = new Map(alumni.map((a) => [String(a.nosis), a]));
  const matched = [], unmatched = [];
  for (const r of records) {
    const a = byNosis.get(String(r.nosis));
    if (a) matched.push({ alumni: a, phone: r.phone });
    else unmatched.push(r.nosis);
  }
  const seen = new Set();
  const uniq = matched.filter((m) => seen.has(m.alumni.id) ? false : seen.add(m.alumni.id));
  const ids = uniq.map((m) => m.alumni.id);
  const { data: members } = await supabase
    .from("members").select("id, alumni_id, nama, isi_form_dpt").in("alumni_id", ids);
  const byAl = new Map(members.map((m) => [m.alumni_id, m]));
  const toFlip = [], needCreate = [];
  let already = 0;
  for (const m of uniq) {
    const ex = byAl.get(m.alumni.id);
    if (!ex) needCreate.push(m);
    else if (ex.isi_form_dpt === "Sudah") already++;
    else toFlip.push(ex);
  }

  let created = 0, flipped = 0;
  if (APPLY) {
    if (needCreate.length) {
      let no = await getNextNo();
      const rows = needCreate.map((m) => ({
        no: no++, nama: m.alumni.nama, angkatan: m.alumni.angkatan,
        no_hp: m.phone || "-", alumni_id: m.alumni.id,
        isi_form_dpt: "Sudah", sudah_dikontak: "Belum", masuk_grup: "Belum",
        registrasi_website_dpt: "Belum", status_dpt: null, vote: "Belum", dukungan: null,
      }));
      const { data, error } = await supabase.from("members").insert(rows).select("id");
      if (error) console.error(`  TN${ang} create error:`, error.message);
      else { created = data.length; nextNo = no; }
    }
    for (const m of toFlip) {
      const { error } = await supabase.from("members").update({ isi_form_dpt: "Sudah" }).eq("id", m.id);
      if (!error) flipped++;
    }
  }
  console.log(`Form TN${ang}: matched=${matched.length}/${records.length} unmatched=${unmatched.length} | already=${already} flip=${toFlip.length} create=${needCreate.length}${APPLY ? ` | applied: ${flipped} flipped, ${created} created` : ''}`);
  if (unmatched.length) console.log(`  unmatched NOSIS: ${unmatched.join(", ")}`);
}

async function processWeb(ang) {
  const list = readFileSync(`scripts/_tn${ang}-web-dpt.txt`, "utf8")
    .split("\n").map((l) => l.trim()).filter(Boolean);
  const { data: alumni } = await supabase
    .from("alumni").select("id, nosis, nama, angkatan").eq("angkatan", ang).in("nosis", list);
  const ids = alumni.map((a) => a.id);
  const { data: members } = await supabase
    .from("members").select("id, alumni_id, registrasi_website_dpt, status_dpt").in("alumni_id", ids);
  const byAl = new Map(members.map((m) => [m.alumni_id, m]));
  const toUpdate = [], needCreate = [];
  let already = 0;
  for (const a of alumni) {
    const ex = byAl.get(a.id);
    if (!ex) needCreate.push(a);
    else if (ex.registrasi_website_dpt === "Sudah" && ex.status_dpt === "Sudah") already++;
    else toUpdate.push(ex);
  }
  const unmatched = list.filter((n) => !alumni.find((a) => a.nosis === n));

  let updated = 0, created = 0;
  if (APPLY) {
    for (const m of toUpdate) {
      const { error } = await supabase.from("members").update({ registrasi_website_dpt: "Sudah", status_dpt: "Sudah" }).eq("id", m.id);
      if (!error) updated++;
    }
    if (needCreate.length) {
      let no = await getNextNo();
      const rows = needCreate.map((a) => ({
        no: no++, nama: a.nama, angkatan: a.angkatan, no_hp: "-", alumni_id: a.id,
        isi_form_dpt: "Sudah", sudah_dikontak: "Belum", masuk_grup: "Belum",
        registrasi_website_dpt: "Sudah", status_dpt: "Sudah", vote: "Belum", dukungan: null,
      }));
      const { data, error } = await supabase.from("members").insert(rows).select("id");
      if (error) console.error(`  TN${ang} create error:`, error.message);
      else { created = data.length; nextNo = no; }
    }
  }
  console.log(`Web  TN${ang}: alumni=${alumni.length}/${list.length} unmatched=${unmatched.length} | already=${already} update=${toUpdate.length} create=${needCreate.length}${APPLY ? ` | applied: ${updated} updated, ${created} created` : ''}`);
  if (unmatched.length) console.log(`  unmatched NOSIS: ${unmatched.join(", ")}`);
}

console.log("── FORM DPT ──");
for (const ang of formAng) await processForm(ang);
console.log("\n── WEB DPT ──");
for (const ang of webAng) await processWeb(ang);

if (!APPLY) console.log("\n→ --apply to write");
