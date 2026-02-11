import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getUserRole, canDelete } from "@/lib/roles";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("members")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const role = await getUserRole(supabase);
  if (!canDelete(role)) {
    return NextResponse.json(
      { error: "Hanya admin yang dapat menghapus anggota" },
      { status: 403 }
    );
  }

  // Delete related attendance records first
  await supabase
    .from("event_attendance")
    .delete()
    .eq("member_id", id);

  // Clear referred_by references pointing to this member
  await supabase
    .from("members")
    .update({ referred_by: null })
    .eq("referred_by", id);

  // Delete the member
  const { error } = await supabase
    .from("members")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
