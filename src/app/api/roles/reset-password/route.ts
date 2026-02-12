import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getUserRole, canManageUsers } from "@/lib/roles";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const currentRole = await getUserRole(supabase);

  if (!canManageUsers(currentRole)) {
    return NextResponse.json(
      { error: "Tidak memiliki akses untuk mengubah password" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { user_id, new_password } = body;

  if (!user_id || !new_password) {
    return NextResponse.json(
      { error: "user_id dan new_password wajib diisi" },
      { status: 400 }
    );
  }

  if (new_password.length < 6) {
    return NextResponse.json(
      { error: "Password minimal 6 karakter" },
      { status: 400 }
    );
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await adminClient.auth.admin.updateUserById(user_id, {
    password: new_password,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
