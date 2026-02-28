import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { searchParams } = new URL(request.url);

  const search = searchParams.get("search");
  const angkatan = searchParams.get("angkatan");
  const linked = searchParams.get("linked");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = (page - 1) * limit;

  // If filtering by linked status, we need to get the set of linked alumni IDs first
  let linkedAlumniIds: string[] | null = null;
  if (linked === "true" || linked === "false") {
    const { data: linkedMembers } = await adminClient
      .from("members")
      .select("alumni_id")
      .not("alumni_id", "is", null);

    linkedAlumniIds = [
      ...new Set((linkedMembers || []).map((m) => m.alumni_id as string)),
    ];
  }

  // Build query - select alumni with member link info
  let query = supabase
    .from("alumni")
    .select(
      "*, members!alumni_id(id, no, no_hp, pic, status_dpt, sudah_dikontak, masuk_grup, vote, dukungan)",
      { count: "exact" }
    );

  if (search) {
    query = query.ilike("nama", `%${search}%`);
  }
  if (angkatan) {
    query = query.eq("angkatan", parseInt(angkatan));
  }

  // Apply linked filter at database level so pagination + count are correct
  if (linked === "true" && linkedAlumniIds) {
    if (linkedAlumniIds.length === 0) {
      // No linked alumni exist — return empty result immediately
      return NextResponse.json({
        data: [],
        total: 0,
        totalLinked: 0,
        page,
        limit,
        totalPages: 0,
      });
    }
    query = query.in("id", linkedAlumniIds);
  } else if (linked === "false" && linkedAlumniIds) {
    if (linkedAlumniIds.length > 0) {
      // Supabase .not().in() to exclude linked alumni
      query = query.not("id", "in", `(${linkedAlumniIds.join(",")})`);
    }
    // If no linked alumni, no filtering needed — all are unlinked
  }

  query = query
    .order("angkatan", { ascending: true })
    .order("nama", { ascending: true })
    .range(offset, offset + limit - 1);

  // Run main query, total linked count (distinct), and unfiltered total in parallel
  const [queryResult, linkedMembersResult, totalAllResult] = await Promise.all([
    query,
    adminClient
      .from("members")
      .select("alumni_id")
      .not("alumni_id", "is", null),
    adminClient
      .from("alumni")
      .select("id", { count: "exact", head: true }),
  ]);

  const { data, count, error } = queryResult;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Count distinct alumni IDs linked to members (avoids double-counting)
  const distinctLinked = new Set(
    (linkedMembersResult.data || []).map((r: { alumni_id: string }) => r.alumni_id)
  ).size;

  // Get event attendance counts for linked members in this page
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const memberIds = (data || []).flatMap((a: any) =>
    (a.members || []).map((m: { id: string }) => m.id)
  ).filter(Boolean) as string[];

  const attendanceCounts: Record<string, number> = {};
  if (memberIds.length > 0) {
    const { data: attRows } = await adminClient
      .from("event_attendance")
      .select("member_id")
      .in("member_id", memberIds);

    for (const a of attRows || []) {
      if (a.member_id) {
        attendanceCounts[a.member_id] = (attendanceCounts[a.member_id] || 0) + 1;
      }
    }
  }

  // Enrich members with attendance_count
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enrichedData = (data || []).map((a: any) => ({
    ...a,
    members: (a.members || []).map((m: { id: string }) => ({
      ...m,
      attendance_count: attendanceCounts[m.id] || 0,
    })),
  }));

  return NextResponse.json({
    data: enrichedData,
    total: count || 0,
    totalAll: totalAllResult.count || 0,
    totalLinked: distinctLinked,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit),
  });
}
