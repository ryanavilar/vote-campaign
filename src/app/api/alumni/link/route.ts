import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getUserRole, canManageUsers } from "@/lib/roles";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAll<T = any>(
  client: SupabaseClient,
  table: string,
  select: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  applyFilters?: (q: any) => any
): Promise<T[]> {
  const PAGE = 1000;
  let all: T[] = [];
  let from = 0;
  while (true) {
    let q = client.from(table).select(select).range(from, from + PAGE - 1);
    if (applyFilters) q = applyFilters(q);
    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) break;
    all = all.concat(data as T[]);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const role = await getUserRole(supabase);

  if (!canManageUsers(role)) {
    return NextResponse.json(
      { error: "Tidak memiliki akses" },
      { status: 403 }
    );
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Check if request body contains specific pairs to link
  let body: { pairs?: { member_id: string; alumni_id: string }[] } = {};
  try {
    body = await request.json();
  } catch {
    // No body = legacy auto-link behavior (kept for backward compat)
  }

  if (body.pairs && body.pairs.length > 0) {
    // Confirm mode: link specific member-alumni pairs
    let linked = 0;
    let failed = 0;

    for (const pair of body.pairs) {
      const { error } = await adminClient
        .from("members")
        .update({ alumni_id: pair.alumni_id })
        .eq("id", pair.member_id);

      if (error) {
        failed++;
      } else {
        linked++;
      }
    }

    return NextResponse.json({ linked, failed });
  }

  // Legacy auto-link: exact name match (paginated to handle >1000 rows)
  let unlinkedMembers: { id: string; nama: string; angkatan: number }[];
  try {
    unlinkedMembers = await fetchAll(
      adminClient, "members", "id, nama, angkatan",
      (q) => q.is("alumni_id", null)
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch members" },
      { status: 500 }
    );
  }

  let matched = 0;
  let unmatched = 0;
  const unmatchedNames: string[] = [];

  for (const member of unlinkedMembers || []) {
    const { data: alumniMatch } = await adminClient
      .from("alumni")
      .select("id")
      .ilike("nama", member.nama.trim())
      .eq("angkatan", member.angkatan)
      .limit(1)
      .maybeSingle();

    if (alumniMatch) {
      await adminClient
        .from("members")
        .update({ alumni_id: alumniMatch.id })
        .eq("id", member.id);
      matched++;
    } else {
      unmatched++;
      unmatchedNames.push(`${member.nama} (TN${member.angkatan})`);
    }
  }

  return NextResponse.json({
    matched,
    unmatched,
    unmatched_names: unmatchedNames,
  });
}
