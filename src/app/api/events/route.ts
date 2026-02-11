import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getUserRole, canEdit } from "@/lib/roles";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("events")
    .select("*, event_attendance(count)")
    .order("tanggal", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const events = (data || []).map((event) => ({
    ...event,
    attendance_count: event.event_attendance?.[0]?.count ?? 0,
    event_attendance: undefined,
  }));

  return NextResponse.json(events);
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const role = await getUserRole(supabase);

  if (!canEdit(role)) {
    return NextResponse.json(
      { error: "Tidak memiliki akses untuk membuat kegiatan" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { nama, jenis, deskripsi, lokasi, tanggal } = body;

  if (!nama || !jenis || !tanggal) {
    return NextResponse.json(
      { error: "Nama, jenis, dan tanggal wajib diisi" },
      { status: 400 }
    );
  }

  const checkin_code = Math.random().toString(36).substring(2, 8).toUpperCase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("events")
    .insert({
      nama,
      jenis,
      deskripsi: deskripsi || null,
      lokasi: lokasi || null,
      tanggal,
      status: "Terjadwal",
      checkin_code,
      created_by: user?.id || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
