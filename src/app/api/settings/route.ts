import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getUserRole, canManageUsers } from "@/lib/roles";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const role = await getUserRole(supabase);

  if (!canManageUsers(role)) {
    return NextResponse.json(
      { error: "Tidak memiliki akses untuk mengelola pengaturan" },
      { status: 403 }
    );
  }

  const key = request.nextUrl.searchParams.get("key");

  if (!key) {
    return NextResponse.json(
      { error: "Parameter key wajib diisi" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("app_settings")
    .select("*")
    .eq("key", key)
    .single();

  if (error) {
    // Not found — return null value
    return NextResponse.json({ key, value: null });
  }

  return NextResponse.json(data);
}

export async function PUT(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const role = await getUserRole(supabase);

  if (!canManageUsers(role)) {
    return NextResponse.json(
      { error: "Tidak memiliki akses untuk mengelola pengaturan" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { key, value } = body;

  if (!key || value === undefined) {
    return NextResponse.json(
      { error: "Key dan value wajib diisi" },
      { status: 400 }
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("app_settings")
    .upsert(
      {
        key,
        value,
        updated_at: new Date().toISOString(),
        updated_by: user?.id,
      },
      { onConflict: "key" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
