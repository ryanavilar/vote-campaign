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
      { error: "Tidak memiliki akses untuk mengelola pengguna" },
      { status: 403 }
    );
  }

  // Fetch roles from user_roles table
  const { data: roles, error: rolesError } = await supabase
    .from("user_roles")
    .select("*");

  if (rolesError) {
    return NextResponse.json(
      { error: rolesError.message },
      { status: 500 }
    );
  }

  // Use service role client to list all auth users
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

  // Combine users with their roles
  const combined = (users || []).map((user) => {
    const userRole = (roles || []).find((r) => r.user_id === user.id);
    return {
      user_id: user.id,
      email: user.email || "",
      role: userRole?.role || "viewer",
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
    };
  });

  return NextResponse.json(combined);
}

export async function PATCH(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const currentRole = await getUserRole(supabase);

  if (!canManageUsers(currentRole)) {
    return NextResponse.json(
      { error: "Tidak memiliki akses untuk mengubah role" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { user_id, role } = body;

  if (!user_id || !role) {
    return NextResponse.json(
      { error: "user_id dan role wajib diisi" },
      { status: 400 }
    );
  }

  const validRoles = ["admin", "koordinator", "viewer"];
  if (!validRoles.includes(role)) {
    return NextResponse.json(
      { error: "Role tidak valid. Pilih: admin, koordinator, atau viewer" },
      { status: 400 }
    );
  }

  // Check if user_role already exists
  const { data: existing } = await supabase
    .from("user_roles")
    .select("*")
    .eq("user_id", user_id)
    .single();

  if (existing) {
    // Update existing role
    const { data, error } = await supabase
      .from("user_roles")
      .update({ role })
      .eq("user_id", user_id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } else {
    // Insert new role
    const { data, error } = await supabase
      .from("user_roles")
      .insert({ user_id, role })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const currentRole = await getUserRole(supabase);

  if (!canManageUsers(currentRole)) {
    return NextResponse.json(
      { error: "Tidak memiliki akses untuk membuat role" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { user_id, role } = body;

  if (!user_id || !role) {
    return NextResponse.json(
      { error: "user_id dan role wajib diisi" },
      { status: 400 }
    );
  }

  const validRoles = ["admin", "koordinator", "viewer"];
  if (!validRoles.includes(role)) {
    return NextResponse.json(
      { error: "Role tidak valid. Pilih: admin, koordinator, atau viewer" },
      { status: 400 }
    );
  }

  // Check if already exists
  const { data: existing } = await supabase
    .from("user_roles")
    .select("*")
    .eq("user_id", user_id)
    .single();

  if (existing) {
    return NextResponse.json(
      { error: "User sudah memiliki role. Gunakan PATCH untuk mengubah." },
      { status: 409 }
    );
  }

  const { data, error } = await supabase
    .from("user_roles")
    .insert({ user_id, role })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const currentRole = await getUserRole(supabase);

  if (!canManageUsers(currentRole)) {
    return NextResponse.json(
      { error: "Tidak memiliki akses untuk menghapus pengguna" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { user_id } = body;

  if (!user_id) {
    return NextResponse.json(
      { error: "user_id wajib diisi" },
      { status: 400 }
    );
  }

  // Prevent self-deletion
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.id === user_id) {
    return NextResponse.json(
      { error: "Tidak dapat menghapus akun sendiri" },
      { status: 400 }
    );
  }

  // Delete role assignment
  await supabase.from("user_roles").delete().eq("user_id", user_id);

  // Delete auth user
  const adminClient = getAdminClient();
  const { error } = await adminClient.auth.admin.deleteUser(user_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
