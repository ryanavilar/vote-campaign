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

// voting_180526_1000.csv
const per_angkatan = {
  1: 128, 2: 69, 3: 156, 4: 106, 5: 100, 6: 126, 7: 276, 8: 117, 9: 155, 10: 156,
  11: 175, 12: 134, 13: 253, 14: 145, 15: 193, 16: 166, 17: 163, 18: 197, 19: 180, 20: 174,
  21: 171, 22: 140, 23: 172, 24: 131, 25: 101, 26: 86, 27: 71, 28: 126, 29: 104, 30: 109,
  31: 155, 32: 148, 33: 101,
};

const total = Object.values(per_angkatan).reduce((a, b) => a + b, 0);
console.log("Total vote panitia:", total);

const { error } = await s.from("app_settings").upsert(
  {
    key: "angkatan_votes_panitia",
    value: { per_angkatan, updated_at: new Date().toISOString() },
    updated_at: new Date().toISOString(),
  },
  { onConflict: "key" }
);

console.log(error ? "ERROR: " + error.message : "Upserted angkatan_votes_panitia (total=" + total + ")");
