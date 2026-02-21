import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getUserRole, canManageUsers } from "@/lib/roles";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const currentRole = await getUserRole(supabase);

  if (!canManageUsers(currentRole)) {
    return NextResponse.json(
      { error: "Tidak memiliki akses untuk mengundang pengguna" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { email, role } = body;

  if (!email || !role) {
    return NextResponse.json(
      { error: "Email dan role wajib diisi" },
      { status: 400 }
    );
  }

  const validRoles = ["admin", "campaigner", "viewer"];
  if (!validRoles.includes(role)) {
    return NextResponse.json(
      { error: "Role tidak valid" },
      { status: 400 }
    );
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Invite user via Supabase Admin
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://ikastara-kita-dashboard.vercel.app";
  const { data: inviteData, error: inviteError } =
    await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${siteUrl}/auth/callback`,
    });

  if (inviteError) {
    // If user already exists, try to find them
    if (inviteError.message.includes("already been registered")) {
      const {
        data: { users },
      } = await adminClient.auth.admin.listUsers();
      const existingUser = users?.find((u) => u.email === email);

      if (existingUser) {
        // Create/update role for existing user
        await adminClient
          .from("user_roles")
          .upsert(
            { user_id: existingUser.id, role },
            { onConflict: "user_id" }
          );

        return NextResponse.json({
          success: true,
          message: "User sudah terdaftar. Role berhasil diperbarui.",
          user_id: existingUser.id,
        });
      }
    }

    return NextResponse.json(
      { error: inviteError.message },
      { status: 500 }
    );
  }

  if (!inviteData.user) {
    return NextResponse.json(
      { error: "Gagal mengundang pengguna" },
      { status: 500 }
    );
  }

  // Create role assignment for the new user
  const { error: roleError } = await adminClient
    .from("user_roles")
    .upsert(
      { user_id: inviteData.user.id, role },
      { onConflict: "user_id" }
    );

  if (roleError) {
    return NextResponse.json(
      { error: "User diundang tapi gagal menyimpan role: " + roleError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Undangan berhasil dikirim ke " + email,
    user_id: inviteData.user.id,
  }, { status: 201 });
}
