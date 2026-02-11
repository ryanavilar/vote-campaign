import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getUserRole, canEdit, canDelete } from "@/lib/roles";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("events")
    .select("*, event_attendance(count)")
    .eq("id", id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  const event = {
    ...data,
    attendance_count: data.event_attendance?.[0]?.count ?? 0,
    event_attendance: undefined,
  };

  return NextResponse.json(event);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const role = await getUserRole(supabase);

  if (!canEdit(role)) {
    return NextResponse.json(
      { error: "Tidak memiliki akses untuk mengubah kegiatan" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const allowedFields = ["nama", "jenis", "deskripsi", "lokasi", "tanggal", "status"];
  const updates: Record<string, unknown> = {};

  for (const field of allowedFields) {
    if (field in body) {
      updates[field] = body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "Tidak ada field yang valid untuk diperbarui" },
      { status: 400 }
    );
  }

  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("events")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
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
      { error: "Hanya admin yang dapat menghapus kegiatan" },
      { status: 403 }
    );
  }

  const { error: attendanceError } = await supabase
    .from("event_attendance")
    .delete()
    .eq("event_id", id);

  if (attendanceError) {
    return NextResponse.json({ error: attendanceError.message }, { status: 500 });
  }

  const { error } = await supabase.from("events").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
