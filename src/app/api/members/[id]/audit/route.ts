import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );

  const { data, error } = await supabaseAdmin
    .from("member_audit_log")
    .select("*")
    .eq("member_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    // If table doesn't exist yet, return empty array
    if (error.code === "42P01") {
      return NextResponse.json([]);
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}
