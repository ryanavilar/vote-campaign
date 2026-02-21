import { createSupabaseServerClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { searchParams } = new URL(request.url);

  const search = searchParams.get("search");
  const angkatan = searchParams.get("angkatan");
  const linked = searchParams.get("linked");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = (page - 1) * limit;

  // Build query - select alumni with member link info
  let query = supabase
    .from("alumni")
    .select("*, members!alumni_id(id, no, no_hp, pic, status_dpt, sudah_dikontak, masuk_grup, vote)", { count: "exact" });

  if (search) {
    query = query.ilike("nama", `%${search}%`);
  }
  if (angkatan) {
    query = query.eq("angkatan", parseInt(angkatan));
  }

  query = query
    .order("angkatan", { ascending: true })
    .order("nama", { ascending: true })
    .range(offset, offset + limit - 1);

  const { data, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Filter by linked status if specified (post-query since Supabase doesn't support filtering on joined nulls easily)
  let filtered = data || [];
  if (linked === "true") {
    filtered = filtered.filter((a: any) => a.members && a.members.length > 0);
  } else if (linked === "false") {
    filtered = filtered.filter(
      (a: any) => !a.members || a.members.length === 0
    );
  }

  return NextResponse.json({
    data: filtered,
    total: count || 0,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit),
  });
}
