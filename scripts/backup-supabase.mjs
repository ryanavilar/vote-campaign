/**
 * Backup all important Supabase tables to JSON files in backups/<timestamp>/
 */
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const TABLES = [
  "alumni", "members", "events", "event_attendance", "form_submissions",
  "user_roles", "campaigner_angkatan", "wa_group_members", "app_settings",
];

const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const dir = join("backups", ts);
mkdirSync(dir, { recursive: true });

const summary = [];
for (const t of TABLES) {
  process.stdout.write(`${t}... `);
  const all = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(t).select("*").range(from, from + 999);
    if (error) { console.log("ERR:", error.message); summary.push({ table: t, ok: false, error: error.message }); break; }
    if (!data || !data.length) break;
    all.push(...data);
    if (data.length < 1000) break;
  }
  writeFileSync(join(dir, `${t}.json`), JSON.stringify(all, null, 2));
  summary.push({ table: t, ok: true, rows: all.length });
  console.log(`${all.length} rows`);
}

writeFileSync(join(dir, "_manifest.json"), JSON.stringify({
  timestamp: ts,
  tables: summary,
  total_rows: summary.reduce((s, r) => s + (r.rows || 0), 0),
}, null, 2));

console.log(`\nBackup → ${dir}`);
console.log(`Total rows: ${summary.reduce((s, r) => s + (r.rows || 0), 0)}`);
