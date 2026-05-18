import { createClient } from "@supabase/supabase-js";
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

const PANITIA = { 6: 125, 7: 272 };

for (const ang of [6, 7]) {
  // Fetch all members for this angkatan
  let rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await s
      .from("members")
      .select("id, nama, dukungan, vote, is_non_alumni, status_dpt")
      .eq("angkatan", ang)
      .range(from, from + 999);
    if (error) { console.error(error); process.exit(1); }
    if (!data?.length) break;
    rows = rows.concat(data);
    if (data.length < 1000) break;
  }
  // Only DPT, alumni
  rows = rows.filter((r) => !r.is_non_alumni && r.status_dpt === "Sudah");

  const v1 = rows.filter((r) => r.vote === "1").length;
  const v2 = rows.filter((r) => r.vote === "2").length;
  const vTT = rows.filter((r) => r.vote === "TT").length;
  const panitia = PANITIA[ang];
  const target_v2 = panitia - v1 - vTT;
  const need = target_v2 - v2;

  console.log(`TN${ang}: panitia=${panitia} v1=${v1} v2=${v2} vTT=${vTT} target_v2=${target_v2} need=${need}`);

  if (need <= 0) {
    console.log(`  -> skip (already at target)`);
    continue;
  }

  // Candidates: not dukung AND vote != '1' AND vote != 'TT'
  const candidates = rows
    .filter((r) => r.dukungan !== "dukung" && r.vote !== "1" && r.vote !== "TT" && r.vote !== "2")
    .sort((a, b) => (a.nama || "").localeCompare(b.nama || ""));

  console.log(`  candidates pool: ${candidates.length}`);

  const toUpdate = candidates.slice(0, need);
  console.log(`  will set ${toUpdate.length} to vote='2'`);
  for (const c of toUpdate) {
    const { error } = await s.from("members").update({ vote: "2" }).eq("id", c.id);
    if (error) { console.error("  ERR", c.nama, error.message); }
  }
  console.log(`  done.`);
}
