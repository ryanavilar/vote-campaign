import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const seedKey = process.env.SEED_SECRET_KEY;

  if (!seedKey || authHeader !== `Bearer ${seedKey}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Create audit log table
  const { error } = await supabaseAdmin.rpc("exec_sql", {
    sql: `
      CREATE TABLE IF NOT EXISTS member_audit_log (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        user_id UUID,
        user_email TEXT,
        field TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        action TEXT NOT NULL DEFAULT 'update',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_audit_member_id ON member_audit_log(member_id);
      CREATE INDEX IF NOT EXISTS idx_audit_user_id ON member_audit_log(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_created_at ON member_audit_log(created_at DESC);
    `,
  });

  if (error) {
    // Try direct SQL if rpc not available
    const { error: directError } = await supabaseAdmin
      .from("member_audit_log")
      .select("id")
      .limit(1);

    if (directError && directError.code === "42P01") {
      // Table doesn't exist — we need to create it via raw SQL
      // Since Supabase JS doesn't support raw SQL, use the REST API
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
          },
          body: JSON.stringify({
            sql: `
              CREATE TABLE IF NOT EXISTS member_audit_log (
                id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
                user_id UUID,
                user_email TEXT,
                field TEXT NOT NULL,
                old_value TEXT,
                new_value TEXT,
                action TEXT NOT NULL DEFAULT 'update',
                created_at TIMESTAMPTZ DEFAULT NOW()
              );
              CREATE INDEX IF NOT EXISTS idx_audit_member_id ON member_audit_log(member_id);
              CREATE INDEX IF NOT EXISTS idx_audit_user_id ON member_audit_log(user_id);
              CREATE INDEX IF NOT EXISTS idx_audit_created_at ON member_audit_log(created_at DESC);
            `,
          }),
        }
      );

      if (!response.ok) {
        return NextResponse.json(
          {
            error: "Could not create table via RPC. Please create it manually via Supabase SQL Editor.",
            sql: `CREATE TABLE IF NOT EXISTS member_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  user_id UUID,
  user_email TEXT,
  field TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  action TEXT NOT NULL DEFAULT 'update',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_member_id ON member_audit_log(member_id);
CREATE INDEX IF NOT EXISTS idx_audit_user_id ON member_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON member_audit_log(created_at DESC);`,
          },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, message: "Table created via REST RPC" });
    }

    // Table already exists
    return NextResponse.json({ success: true, message: "Table already exists" });
  }

  return NextResponse.json({ success: true, message: "Table created via RPC" });
}
