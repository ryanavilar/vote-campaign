/**
 * TN19 PDT-verified alumni dengan no member row → create member dengan
 * isi_form_dpt=Sudah, registrasi_website_dpt=Sudah, status_dpt=Sudah.
 * (DPT terverifikasi → implisit form & web sudah lolos.)
 */
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const APPLY = process.argv.includes("--apply");
const ANG = 19;

const list = readFileSync("scripts/_tn19-web-dpt.txt", "utf8")
  .split("\n").map((l) => l.trim()).filter(Boolean);
console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"} | TN${ANG} NOSIS: ${list.length}\n`);

const { data: alumni } = await supabase
  .from("alumni").select("id, nosis, nama, angkatan").eq("angkatan", ANG).in("nosis", list);
const ids = alumni.map((a) => a.id);
const { data: members } = await supabase
  .from("members").select("id, alumni_id").in("alumni_id", ids);
const haveMember = new Set(members.map((m) => m.alumni_id));
const needCreate = alumni.filter((a) => !haveMember.has(a.id));
console.log(`Alumni: ${alumni.length}, has member: ${haveMember.size}, need create: ${needCreate.length}`);

if (!APPLY) { console.log("\n→ --apply to write"); process.exit(0); }

if (needCreate.length === 0) { console.log("Nothing to create"); process.exit(0); }

const { data: maxRow } = await supabase.from("members").select("no").order("no", { ascending: false }).limit(1).single();
let nextNo = (maxRow.no ?? 0) + 1;
const rows = needCreate.map((a) => ({
  no: nextNo++, nama: a.nama, angkatan: a.angkatan, no_hp: "-", alumni_id: a.id,
  isi_form_dpt: "Sudah", sudah_dikontak: "Belum", masuk_grup: "Belum",
  registrasi_website_dpt: "Sudah", status_dpt: "Sudah", vote: "Belum", dukungan: null,
}));
const { data, error } = await supabase.from("members").insert(rows).select("id");
if (error) console.error("create error:", error.message);
else console.log(`→ created=${data.length}`);
