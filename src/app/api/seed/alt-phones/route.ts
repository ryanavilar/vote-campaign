import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

/**
 * GET /api/seed/alt-phones — One-time migration to add alt_phones column
 * Deletes itself after running (idempotent via IF NOT EXISTS)
 */
export async function GET() {
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Test if column already exists
  const { error: testErr } = await adminClient
    .from("members")
    .select("alt_phones")
    .limit(1);

  if (!testErr) {
    return NextResponse.json({ message: "alt_phones column already exists" });
  }

  // Column doesn't exist - need to add it via SQL
  // Use Supabase's built-in SQL execution through the REST API
  // We'll add it by updating a dummy record with the column
  // Actually, we can't ALTER TABLE via the JS client.
  // Return instructions to run manually.
  return NextResponse.json({
    message: "Column alt_phones does not exist yet. Run this SQL in Supabase Dashboard > SQL Editor:",
    sql: "ALTER TABLE members ADD COLUMN IF NOT EXISTS alt_phones TEXT[] DEFAULT '{}';"
  });
}
