import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const get = (k) => env.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1];

const supabase = createClient(
  get("NEXT_PUBLIC_SUPABASE_URL"),
  get("SUPABASE_SERVICE_ROLE_KEY")
);

const { data: subs, error } = await supabase
  .from("form_submissions")
  .select("member_id, no_hp, created_at")
  .eq("type", "dukungan")
  .not("member_id", "is", null)
  .order("created_at", { ascending: false });

if (error) throw error;

const latest = new Map();
for (const s of subs) {
  if (!latest.has(s.member_id)) latest.set(s.member_id, s);
}

console.log(`Backfilling ${latest.size} members from ${subs.length} dukungan submissions...`);

let ok = 0, fail = 0;
for (const [memberId, s] of latest) {
  const update = { sudah_dikontak: "Sudah", dukungan: "dukung" };
  if (s.no_hp && s.no_hp.trim()) update.no_hp = s.no_hp.trim();
  const { error: uerr } = await supabase
    .from("members")
    .update(update)
    .eq("id", memberId);
  if (uerr) { fail++; console.error(memberId, uerr.message); }
  else ok++;
}

console.log(`Done. ok=${ok} fail=${fail}`);
