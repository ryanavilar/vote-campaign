import { NextRequest, NextResponse } from "next/server";

const SUPABASE_PROJECT_REF = "unzusbynaxkticlgtrsg";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const seedKey = process.env.SEED_SECRET_KEY;

  if (!seedKey || authHeader !== `Bearer ${seedKey}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  // Use PostgREST to run SQL via the rpc endpoint
  // First, create the table using the Supabase REST API
  const sql = `
    CREATE TABLE IF NOT EXISTS wa_group_members (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      phone TEXT NOT NULL,
      wa_name TEXT,
      member_id UUID REFERENCES members(id) ON DELETE SET NULL,
      synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS wa_group_members_phone_idx ON wa_group_members(phone);

    ALTER TABLE wa_group_members ENABLE ROW LEVEL SECURITY;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'wa_group_members' AND policyname = 'wa_group_members_auth_all'
      ) THEN
        CREATE POLICY wa_group_members_auth_all ON wa_group_members
          FOR ALL TO authenticated
          USING (true)
          WITH CHECK (true);
      END IF;
    END
    $$;
  `;

  try {
    // Execute SQL via Supabase's pg_net or direct connection
    // Using the /rest/v1/rpc approach with a custom function
    // If that fails, provide the SQL for manual execution
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ sql }),
    });

    if (res.ok) {
      return NextResponse.json({
        message: "wa_group_members table created successfully",
      });
    }

    // Fallback: return the SQL for manual execution
    return NextResponse.json({
      message: "Auto-creation not available. Please run this SQL in Supabase Dashboard SQL Editor:",
      sql: sql.trim(),
    });
  } catch {
    return NextResponse.json({
      message: "Please run this SQL in Supabase Dashboard SQL Editor:",
      sql: sql.trim(),
    });
  }
}
