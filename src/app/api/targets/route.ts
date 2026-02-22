import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getUserRole, canEdit } from "@/lib/roles";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

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

/**
 * GET /api/targets — Returns current campaigner's target members
 */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const role = await getUserRole(supabase);

  if (!canEdit(role)) {
    return NextResponse.json(
      { error: "Tidak memiliki akses" },
      { status: 403 }
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminClient = getAdminClient();

  // Fetch target member IDs from junction table
  const { data: targets, error: targetsError } = await adminClient
    .from("campaigner_targets")
    .select("member_id")
    .eq("user_id", user.id);

  if (targetsError) {
    return NextResponse.json(
      { error: targetsError.message },
      { status: 500 }
    );
  }

  if (!targets || targets.length === 0) {
    return NextResponse.json([]);
  }

  const memberIds = targets.map((t) => t.member_id);

  // Fetch full member data — paginate if needed
  let members;
  try {
    members = await fetchAll(adminClient, "members", "*", (q) =>
      q.in("id", memberIds).order("no", { ascending: true })
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch members" },
      { status: 500 }
    );
  }

  return NextResponse.json(members);
}

/**
 * POST /api/targets — Add an alumni as campaigner's target
 * Body: { alumni_id: string }
 * - If alumni has a linked member → add to campaigner_targets
 * - If alumni has NO linked member → create member, link, add to targets
 */
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const role = await getUserRole(supabase);

  if (!canEdit(role)) {
    return NextResponse.json(
      { error: "Tidak memiliki akses" },
      { status: 403 }
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { alumni_id } = body;

  if (!alumni_id) {
    return NextResponse.json(
      { error: "alumni_id wajib diisi" },
      { status: 400 }
    );
  }

  const adminClient = getAdminClient();

  // Check if alumni exists
  const { data: alumni, error: alumniError } = await adminClient
    .from("alumni")
    .select("id, nama, angkatan")
    .eq("id", alumni_id)
    .single();

  if (alumniError || !alumni) {
    return NextResponse.json(
      { error: "Alumni tidak ditemukan" },
      { status: 404 }
    );
  }

  // Check if alumni already has a linked member
  const { data: existingMember } = await adminClient
    .from("members")
    .select("id, nama")
    .eq("alumni_id", alumni_id)
    .maybeSingle();

  let memberId: string;

  if (existingMember) {
    memberId = existingMember.id;
  } else {
    // Create new member from alumni data
    const { data: maxNoRow } = await adminClient
      .from("members")
      .select("no")
      .order("no", { ascending: false })
      .limit(1)
      .single();

    const nextNo = (maxNoRow?.no || 0) + 1;

    const { data: newMember, error: insertError } = await adminClient
      .from("members")
      .insert({
        no: nextNo,
        nama: alumni.nama,
        angkatan: alumni.angkatan,
        no_hp: "",
        alumni_id: alumni.id,
        status_dpt: null,
        sudah_dikontak: null,
        masuk_grup: null,
        vote: null,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    memberId = newMember.id;
  }

  // Add to campaigner_targets junction table
  const { error: targetError } = await adminClient
    .from("campaigner_targets")
    .insert({ user_id: user.id, member_id: memberId })
    .select()
    .single();

  if (targetError) {
    if (targetError.code === "23505") {
      // unique constraint violation — already targeted
      return NextResponse.json(
        { error: "Alumni sudah menjadi target Anda" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: targetError.message },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      member_id: memberId,
      action: existingMember ? "assigned" : "created",
    },
    { status: 201 }
  );
}

/**
 * DELETE /api/targets — Remove a member from campaigner's target list
 * Body: { member_id: string }
 */
export async function DELETE(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const role = await getUserRole(supabase);

  if (!canEdit(role)) {
    return NextResponse.json(
      { error: "Tidak memiliki akses" },
      { status: 403 }
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { member_id } = body;

  if (!member_id) {
    return NextResponse.json(
      { error: "member_id wajib diisi" },
      { status: 400 }
    );
  }

  const adminClient = getAdminClient();

  const { error } = await adminClient
    .from("campaigner_targets")
    .delete()
    .eq("user_id", user.id)
    .eq("member_id", member_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
