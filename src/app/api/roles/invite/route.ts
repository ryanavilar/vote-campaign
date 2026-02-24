import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getUserRole, canManageUsers, isSuperAdmin } from "@/lib/roles";
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
  const { email, role, password, autoConfirm } = body;

  if (!email || !role) {
    return NextResponse.json(
      { error: "Email dan role wajib diisi" },
      { status: 400 }
    );
  }

  // Only super_admin can invite as super_admin
  const validRoles = isSuperAdmin(currentRole)
    ? ["super_admin", "admin", "campaigner", "viewer"]
    : ["admin", "campaigner", "viewer"];

  if (!validRoles.includes(role)) {
    return NextResponse.json(
      { error: "Role tidak valid atau Anda tidak memiliki izin untuk mengatur role ini" },
      { status: 400 }
    );
  }

  // Only super_admin can auto-confirm accounts
  if (autoConfirm && !isSuperAdmin(currentRole)) {
    return NextResponse.json(
      { error: "Hanya Super Admin yang dapat membuat akun langsung (auto-confirm)" },
      { status: 403 }
    );
  }

  if (autoConfirm && (!password || password.length < 6)) {
    return NextResponse.json(
      { error: "Password wajib diisi (minimal 6 karakter) untuk akun auto-confirm" },
      { status: 400 }
    );
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // --- Auto-confirm mode (super_admin only): create user directly with password ---
  if (autoConfirm && isSuperAdmin(currentRole)) {
    const { data: createData, error: createError } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (createError) {
      // If user already exists, update their role and password
      if (createError.message.includes("already been registered") || createError.message.includes("already exists")) {
        const {
          data: { users },
        } = await adminClient.auth.admin.listUsers();
        const existingUser = users?.find((u) => u.email === email);

        if (existingUser) {
          // Update password
          await adminClient.auth.admin.updateUserById(existingUser.id, {
            password,
            email_confirm: true,
          });

          // Create/update role
          await adminClient
            .from("user_roles")
            .upsert(
              { user_id: existingUser.id, role },
              { onConflict: "user_id" }
            );

          return NextResponse.json({
            success: true,
            message: `User ${email} sudah ada. Password dan role berhasil diperbarui.`,
            user_id: existingUser.id,
          });
        }
      }

      return NextResponse.json(
        { error: createError.message },
        { status: 500 }
      );
    }

    if (!createData.user) {
      return NextResponse.json(
        { error: "Gagal membuat akun" },
        { status: 500 }
      );
    }

    // Create role assignment
    const { error: roleError } = await adminClient
      .from("user_roles")
      .upsert(
        { user_id: createData.user.id, role },
        { onConflict: "user_id" }
      );

    if (roleError) {
      return NextResponse.json(
        { error: "Akun dibuat tapi gagal menyimpan role: " + roleError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Akun ${email} berhasil dibuat dan langsung aktif.`,
      user_id: createData.user.id,
    }, { status: 201 });
  }

  // --- Normal invite mode: send confirmation email ---
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
