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

  // Fetch all members with assigned_to field
  const { data: members, error: membersError } = await supabase
    .from("members")
    .select("id, nama, angkatan, no_hp, assigned_to")
    .order("nama");

  if (membersError) {
    return NextResponse.json(
      { error: membersError.message },
      { status: 500 }
    );
  }

  // Fetch all auth users via admin client
  const adminClient = getAdminClient();
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

  const { data, error } = await supabase
    .from("members")
    .update({ assigned_to: campaigner_id })
    .in("id", member_ids)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

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
  const { member_ids } = body;

  if (!member_ids || !Array.isArray(member_ids) || member_ids.length === 0) {
    return NextResponse.json(
      { error: "member_ids wajib diisi" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("members")
    .update({ assigned_to: null })
    .in("id", member_ids);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
