import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envContent = readFileSync(".env.local", "utf8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx > 0) {
    process.env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const sql = readFileSync("supabase/migrations/20260226_super_admin_role.sql", "utf8");

// Parse SQL into individual statements
const statements = [];
let current = "";
for (const line of sql.split("\n")) {
  const trimmed = line.trim();
  if (trimmed.startsWith("--") || trimmed.length === 0) continue;
  current += " " + trimmed;
  if (trimmed.endsWith(";")) {
    statements.push(current.trim());
    current = "";
  }
}

console.log(`Found ${statements.length} SQL statements\n`);

for (let i = 0; i < statements.length; i++) {
  const stmt = statements[i];
  const preview = stmt.substring(0, 80);

  // Execute via Supabase REST - use the postgres function approach
  const { data, error } = await supabase.from("_exec_sql").select().limit(0);

  // Since we can't run raw SQL via Supabase JS client easily,
  // use the Management API via fetch
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({}),
  });

  // Alternative: use the SQL endpoint from Supabase Management API
  // Actually, let's just use supabase-js to run each statement via pg
  console.log(`[${i + 1}/${statements.length}] ${preview}...`);
}

// Since we can't run raw SQL easily through supabase-js,
// let's try using the Supabase Management API SQL endpoint
const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL.match(/https:\/\/(.+?)\.supabase/)?.[1];
if (!projectRef) {
  console.error("Could not extract project ref from URL");
  process.exit(1);
}

console.log(`\nProject ref: ${projectRef}`);
console.log("Executing full migration as single SQL...\n");

// Run the full SQL via the Supabase SQL endpoint
const fullSql = statements.join("\n");
const response = await fetch(`https://${projectRef}.supabase.co/pg`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
  },
  body: JSON.stringify({ query: fullSql }),
});

if (response.ok) {
  const result = await response.json();
  console.log("Migration applied successfully!");
  console.log(JSON.stringify(result, null, 2));
} else {
  const errText = await response.text();
  console.error(`Failed (${response.status}): ${errText}`);

  // Fallback: try statements one by one
  console.log("\nTrying statements one by one...\n");
  for (let i = 0; i < statements.length; i++) {
    const resp = await fetch(`https://${projectRef}.supabase.co/pg`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ query: statements[i] }),
    });

    if (resp.ok) {
      console.log(`✅ [${i + 1}] ${statements[i].substring(0, 70)}...`);
    } else {
      const err = await resp.text();
      console.log(`❌ [${i + 1}] ${statements[i].substring(0, 70)}...`);
      console.log(`   Error: ${err}`);
    }
  }
}
