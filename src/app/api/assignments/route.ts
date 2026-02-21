import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getUserRole, canManageUsers } from "@/lib/roles";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const role = await getUserRole(supabase);

  if (!canManageUsers(role)) {
    return NextResponse.json(
      { error: "Tidak memiliki akses untuk mengelola penugasan" },
      { status: 403 }
    );
  }

  const adminClient = getAdminClient();

  // Fetch all members with their campaigner_targets
  const { data: members, error: membersError } = await supabase
    .from("members")
    .select("id, nama, angkatan, no_hp, assigned_to, campaigner_targets(user_id)")
    .order("nama");

  if (membersError) {
    return NextResponse.json(
      { error: membersError.message },
      { status: 500 }
    );
  }

  // Fetch all auth users via admin client
  const {
    data: { users },
    error: usersError,
  } = await adminClient.auth.admin.listUsers();

  if (usersError) {
    return NextResponse.json(
      { error: usersError.message },
      { status: 500 }
    );
  }

  // Fetch campaigner roles from user_roles table
  const { data: campaignerRoles, error: rolesError } = await supabase
    .from("user_roles")
    .select("*")
    .eq("role", "campaigner");

  if (rolesError) {
    return NextResponse.json(
      { error: rolesError.message },
      { status: 500 }
    );
  }

  // Cross-reference to get campaigner user details
  const campaignerUserIds = new Set(
    (campaignerRoles || []).map((r) => r.user_id)
  );

  const campaigners = (users || [])
    .filter((user) => campaignerUserIds.has(user.id))
    .map((user) => ({
      user_id: user.id,
      email: user.email || "",
    }));

  return NextResponse.json({ members, campaigners });
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const role = await getUserRole(supabase);

  if (!canManageUsers(role)) {
    return NextResponse.json(
      { error: "Tidak memiliki akses untuk mengelola penugasan" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { campaigner_id, member_ids } = body;

  if (!campaigner_id || !member_ids || !Array.isArray(member_ids) || member_ids.length === 0) {
    return NextResponse.json(
      { error: "campaigner_id dan member_ids wajib diisi" },
      { status: 400 }
    );
  }

  const adminClient = getAdminClient();

  // Update assigned_to for backward compat
  const { data, error } = await supabase
    .from("members")
    .update({ assigned_to: campaigner_id })
    .in("id", member_ids)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Also insert into junction table
  const inserts = member_ids.map((mid: string) => ({
    user_id: campaigner_id,
    member_id: mid,
  }));

  await adminClient
    .from("campaigner_targets")
    .upsert(inserts, { onConflict: "user_id,member_id" });

  return NextResponse.json({ success: true, count: data?.length || 0 });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const role = await getUserRole(supabase);

  if (!canManageUsers(role)) {
    return NextResponse.json(
      { error: "Tidak memiliki akses untuk mengelola penugasan" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { member_ids, campaigner_id } = body;

  if (!member_ids || !Array.isArray(member_ids) || member_ids.length === 0) {
    return NextResponse.json(
      { error: "member_ids wajib diisi" },
      { status: 400 }
    );
  }

  const adminClient = getAdminClient();

  // Clear assigned_to (backward compat)
  const { error } = await supabase
    .from("members")
    .update({ assigned_to: null })
    .in("id", member_ids);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Also remove from junction table
  if (campaigner_id) {
    for (const mid of member_ids) {
      await adminClient
        .from("campaigner_targets")
        .delete()
        .eq("user_id", campaigner_id)
        .eq("member_id", mid);
    }
  }

  return NextResponse.json({ success: true });
}
