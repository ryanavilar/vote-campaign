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
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const s = createClient(url, key);

// voting_170526_2200.csv
const per_angkatan = {
  1: 125, 2: 67, 3: 146, 4: 102, 5: 99, 6: 125, 7: 272, 8: 113, 9: 151, 10: 150,
  11: 165, 12: 123, 13: 251, 14: 139, 15: 185, 16: 161, 17: 154, 18: 184, 19: 173, 20: 165,
  21: 169, 22: 134, 23: 161, 24: 126, 25: 94, 26: 83, 27: 67, 28: 123, 29: 98, 30: 106,
  31: 151, 32: 141, 33: 97,
};

const total = Object.values(per_angkatan).reduce((a, b) => a + b, 0);
console.log("Total vote panitia:", total);

const { data, error } = await s.from("app_settings").upsert(
  {
    key: "angkatan_votes_panitia",
    value: { per_angkatan, updated_at: new Date().toISOString() },
    updated_at: new Date().toISOString(),
  },
  { onConflict: "key" }
).select();

console.log(error ? "ERROR: " + error.message : "Upserted angkatan_votes_panitia (total=" + total + ")");
