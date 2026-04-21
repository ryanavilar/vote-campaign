/**
 * Post-DPT-form reconciliation:
 * 1. Fix 2 NOSIS typos in form submissions (submitted NOSIS != master) — just
 *    set isi_form_dpt=Sudah on the REAL member (already linked to the right alumni).
 * 2. Generate alumni + member rows for 3 form respondents whose NOSIS is not
 *    in the master — they submitted valid forms so we trust them.
 *
 * Usage:
 *   node --env-file=.env.local scripts/fix-typos-and-seed-missing.mjs [--apply]
 */
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const APPLY = process.argv.includes("--apply");

const TYPOS = [
  { ang: 21, realNosis: "106033", name: "Tiffany Yafisana Utami" },
  { ang: 21, realNosis: "106097", name: "Wisnu Faishal Rasyid" },
];

const NEW_ALUMNI = [
  { ang: 17, nosis: "064908", nama: "Muhammad Ridwan",       no_hp: "085132478938" },
  { ang: 17, nosis: "064816", nama: "Tomi Sugiarto",         no_hp: "082218787952" },
  { ang: 21, nosis: "365290", nama: "Ahmad Shafa Hanif",     no_hp: "082134366665" },
];

function normPhone(p) {
  if (!p) return null;
  let s = String(p).replace(/\s+/g, "").replace(/[^\d+]/g, "");
  if (s.startsWith("0")) s = "62" + s.slice(1);
  if (s.startsWith("+")) s = s.slice(1);
  return s || null;
}

console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"}\n`);

// === 1. Fix typos: set isi_form_dpt=Sudah on the REAL member ===
console.log("=== Fix 2 NOSIS typos (update existing member by real NOSIS) ===");
for (const t of TYPOS) {
  const { data: alumni } = await supabase
    .from("alumni").select("id, nosis, nama").eq("angkatan", t.ang).eq("nosis", t.realNosis).single();
  if (!alumni) { console.log(`  ❌ TN${t.ang} ${t.realNosis} alumni NOT FOUND`); continue; }

  const { data: member } = await supabase
    .from("members").select("id, nama, isi_form_dpt").eq("alumni_id", alumni.id).maybeSingle();
  if (!member) { console.log(`  ⚠ TN${t.ang} ${t.realNosis} ${alumni.nama} — alumni exists but no member row`); continue; }

  if (member.isi_form_dpt === "Sudah") {
    console.log(`  ✓ TN${t.ang} ${t.realNosis} ${alumni.nama} already Sudah (skip)`);
    continue;
  }
  console.log(`  → TN${t.ang} ${t.realNosis} ${alumni.nama} member ${member.id}: Belum → Sudah`);
  if (APPLY) {
    const { error } = await supabase.from("members").update({ isi_form_dpt: "Sudah" }).eq("id", member.id);
    if (error) console.log(`    ❌ ${error.message}`);
    else console.log(`    ✓ updated`);
  }
}

// === 2. Seed 3 new alumni + member rows ===
console.log("\n=== Seed 3 new alumni (not in master) ===");

// Next no for members
const { data: maxRow } = await supabase.from("members").select("no").order("no", { ascending: false }).limit(1).single();
let nextNo = (maxRow.no ?? 0) + 1;
console.log(`Starting member no: ${nextNo}\n`);

for (const a of NEW_ALUMNI) {
  // Guard: check if nosis already exists
  const { data: existingAlumni } = await supabase.from("alumni").select("id, nama").eq("nosis", a.nosis).maybeSingle();
  if (existingAlumni) {
    console.log(`  ⚠ NOSIS ${a.nosis} already exists (${existingAlumni.nama}) — skip`);
    continue;
  }

  const phone = normPhone(a.no_hp) || "-";
  console.log(`  + TN${a.ang} ${a.nosis} "${a.nama}" phone=${phone} member_no=${nextNo}`);

  if (APPLY) {
    const { data: newAlumni, error: eA } = await supabase
      .from("alumni").insert({ nosis: a.nosis, nama: a.nama, angkatan: a.ang })
      .select("id").single();
    if (eA) { console.log(`    ❌ alumni insert: ${eA.message}`); continue; }

    const { error: eM } = await supabase.from("members").insert({
      no: nextNo++,
      nama: a.nama,
      angkatan: a.ang,
      no_hp: phone,
      alumni_id: newAlumni.id,
      isi_form_dpt: "Sudah",
      sudah_dikontak: "Belum",
      masuk_grup: "Belum",
      registrasi_website_dpt: "Belum",
      status_dpt: null,
      vote: "Belum",
      dukungan: null,
    });
    if (eM) console.log(`    ❌ member insert: ${eM.message}`);
    else    console.log(`    ✓ alumni + member created`);
  } else {
    nextNo++;
  }
}

if (!APPLY) console.log("\n→ Re-run with --apply to write.");
