import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getUserRole, canEdit, isAdmin } from "@/lib/roles";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const KEY = "angkatan_votes_panitia";

type VotesValue = {
  per_angkatan: Record<string, number>;
  updated_at?: string;
};

const EMPTY: VotesValue = { per_angkatan: {} };

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const role = await getUserRole(supabase);
  if (!canEdit(role)) {
    return NextResponse.json({ error: "Tidak memiliki akses" }, { status: 403 });
  }
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("app_settings")
    .select("value, updated_at")
    .eq("key", KEY)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    value: (data?.value as VotesValue) || EMPTY,
    updated_at: data?.updated_at || null,
  });
}

export async function PUT(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const role = await getUserRole(supabase);
  if (!isAdmin(role)) {
    return NextResponse.json({ error: "Hanya admin yang bisa update" }, { status: 403 });
  }
  const body = await request.json();
  const { per_angkatan } = body as VotesValue;
  if (!per_angkatan || typeof per_angkatan !== "object") {
    return NextResponse.json({ error: "per_angkatan wajib" }, { status: 400 });
  }
  const { data: { user } } = await supabase.auth.getUser();
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("app_settings")
    .upsert(
      {
        key: KEY,
        value: { per_angkatan, updated_at: new Date().toISOString() },
        updated_at: new Date().toISOString(),
        updated_by: user?.id,
      },
      { onConflict: "key" }
    )
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
