import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getUserRole, canManageUsers } from "@/lib/roles";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

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

  // Legacy auto-link: exact name match
  const { data: unlinkedMembers, error: membersError } = await adminClient
    .from("members")
    .select("id, nama, angkatan")
    .is("alumni_id", null);

  if (membersError) {
    return NextResponse.json(
      { error: membersError.message },
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
