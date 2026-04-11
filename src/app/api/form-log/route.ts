import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get("page") || "1");
  const limit = Math.min(Number(searchParams.get("limit") || "50"), 100);
  const type = searchParams.get("type");
  const search = searchParams.get("search");
  const filterUnlinked = searchParams.get("unlinked") === "true";

  const offset = (page - 1) * limit;

  let query = supabase
    .from("form_submissions")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (type && ["dukungan", "event"].includes(type)) {
    query = query.eq("type", type);
  }

  if (search) {
    query = query.or(
      `nama.ilike.%${search}%,no_hp.ilike.%${search}%,referral_name.ilike.%${search}%`
    );
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Enrich with alumni link status from members table
  const adminClient = getAdminClient();
  const memberIds = (data || [])
    .map((d) => d.member_id)
    .filter((id): id is string => !!id);

  let alumniMap: Record<string, boolean> = {};
  if (memberIds.length > 0) {
    const { data: members } = await adminClient
      .from("members")
      .select("id, alumni_id")
      .in("id", memberIds);

    if (members) {
      for (const m of members) {
        alumniMap[m.id] = !!m.alumni_id;
      }
    }
  }

  const enriched = (data || []).map((sub) => ({
    ...sub,
    has_alumni_link: sub.member_id ? (alumniMap[sub.member_id] ?? false) : false,
  }));

  // Count unlinked: form submissions whose member has no alumni_id
  let unlinkedCount = 0;
  if (memberIds.length > 0) {
    const { count: uc } = await adminClient
      .from("members")
      .select("id", { count: "exact", head: true })
      .in("id", memberIds)
      .is("alumni_id", null)
      .not("is_non_alumni", "is", true);
    unlinkedCount = uc || 0;
  }

  return NextResponse.json({
    data: enriched,
    total: count || 0,
    unlinked_count: unlinkedCount,
    page,
    limit,
  });
}
