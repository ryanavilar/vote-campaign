import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getUserRole, canEdit } from "@/lib/roles";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const role = await getUserRole(supabase);

  if (!canEdit(role)) {
    return NextResponse.json(
      { error: "Tidak memiliki akses" },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";
  const angkatan = searchParams.get("angkatan");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const offset = (page - 1) * limit;

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let query = adminClient
    .from("alumni")
    .select(
      "id, nama, angkatan, kelanjutan_studi, program_studi, members!alumni_id(id, nama, campaigner_targets(user_id))",
      { count: "exact" }
    );

  if (q.length >= 2) {
    query = query.ilike("nama", `%${q}%`);
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

  return NextResponse.json({
    data: data || [],
    total: count || 0,
    page,
    limit,
  });
}
