import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getUserRole, canManageUsers } from "@/lib/roles";
import { NextRequest, NextResponse } from "next/server";

// GET ?q=searchTerm — search members by name or phone for the link modal
export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const role = await getUserRole(supabase);

  if (!canManageUsers(role)) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim() || "";

  if (!q) {
    return NextResponse.json({ data: [] });
  }

  const { data, error } = await supabase
    .from("members")
    .select("id, nama, no_hp, angkatan")
    .or(`nama.ilike.%${q}%,no_hp.ilike.%${q}%`)
    .order("nama", { ascending: true })
    .limit(10);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data || [] });
}
