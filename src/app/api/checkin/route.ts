import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getUserRole, canEdit } from "@/lib/roles";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();

  const role = await getUserRole(supabase);
  if (!canEdit(role)) {
    return NextResponse.json(
      { error: "Tidak memiliki akses untuk check-in" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { checkin_code, member_id, catatan } = body;

  if (!checkin_code || !member_id) {
    return NextResponse.json(
      { error: "checkin_code dan member_id wajib diisi" },
      { status: 400 }
    );
  }

  // Look up event by checkin_code
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, nama, status")
    .eq("checkin_code", checkin_code.toUpperCase())
    .single();

  if (eventError || !event) {
    return NextResponse.json(
      { error: "Kode check-in tidak ditemukan" },
      { status: 404 }
    );
  }

  if (event.status === "Dibatalkan") {
    return NextResponse.json(
      { error: "Kegiatan ini telah dibatalkan" },
      { status: 400 }
    );
  }

  if (event.status === "Selesai") {
    return NextResponse.json(
      { error: "Kegiatan ini sudah selesai" },
      { status: 400 }
    );
  }

  // Check if member exists
  const { data: member, error: memberError } = await supabase
    .from("members")
    .select("id, nama")
    .eq("id", member_id)
    .single();

  if (memberError || !member) {
    return NextResponse.json(
      { error: "Anggota tidak ditemukan" },
      { status: 404 }
    );
  }

  // Check if member already checked in
  const { data: existing } = await supabase
    .from("event_attendance")
    .select("id")
    .eq("event_id", event.id)
    .eq("member_id", member_id)
    .single();

  if (existing) {
    return NextResponse.json(
      { error: "Anggota sudah melakukan check-in untuk kegiatan ini" },
      { status: 409 }
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("event_attendance")
    .insert({
      event_id: event.id,
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

  return NextResponse.json(
    {
      success: true,
      message: `${member.nama} berhasil check-in`,
      attendance: { ...data, event_nama: event.nama },
    },
    { status: 201 }
  );
}
