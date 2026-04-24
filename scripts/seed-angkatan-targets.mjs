/**
 * Seed angkatan dukung targets into app_settings (single JSON row).
 * Editable later via Studio or PUT /api/angkatan-targets.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\\n"?$/, "").replace(/"/g, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY.replace(/"/g, "");
const s = createClient(url, key);

const targets = {
  per_angkatan: {
    13: 150, 14: 50, 15: 150, 16: 50, 17: 170, 18: 150, 19: 50, 20: 130,
    21: 151, 22: 30, 23: 50, 24: 200, 25: 30, 27: 50, 28: 50, 29: 50,
    30: 99, 31: 80, 32: 80,
  },
  groups: {
    A1_A5: 50,
    A6_A12: 70,
  },
  updated_at: new Date().toISOString(),
};

const { data, error } = await s.from("app_settings").upsert(
  { key: "angkatan_targets", value: targets, updated_at: new Date().toISOString() },
  { onConflict: "key" }
).select();

console.log(error ? "ERROR: " + error.message : "Seeded: " + JSON.stringify(data, null, 2));
