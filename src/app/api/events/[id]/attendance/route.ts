import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getUserRole, canEdit } from "@/lib/roles";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("event_attendance")
    .select("*, member:members(*)")
    .eq("event_id", id)
    .order("checked_in_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const role = await getUserRole(supabase);

  if (!canEdit(role)) {
    return NextResponse.json(
      { error: "Tidak memiliki akses untuk check-in anggota" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { member_id, catatan } = body;

  if (!member_id) {
    return NextResponse.json(
      { error: "member_id wajib diisi" },
      { status: 400 }
    );
  }

  // Check if member is already checked in
  const { data: existing } = await supabase
    .from("event_attendance")
    .select("id")
    .eq("event_id", id)
    .eq("member_id", member_id)
    .single();

  if (existing) {
    return NextResponse.json(
      { error: "Anggota sudah check-in di kegiatan ini" },
      { status: 409 }
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("event_attendance")
    .insert({
      event_id: id,
      member_id,
      checked_in_at: new Date().toISOString(),
      checked_in_by: user?.id || null,
      catatan: catatan || null,
    })
    .select("*, member:members(*)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const role = await getUserRole(supabase);

  if (!canEdit(role)) {
    return NextResponse.json(
      { error: "Tidak memiliki akses untuk menghapus check-in" },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const attendance_id = searchParams.get("attendance_id");

  if (!attendance_id) {
    return NextResponse.json(
      { error: "attendance_id wajib diisi" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("event_attendance")
    .delete()
    .eq("id", attendance_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
