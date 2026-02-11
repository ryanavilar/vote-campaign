import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.json({ error: "Parameter 'code' diperlukan" }, { status: 400 });
  }

  const { data: event, error } = await supabaseAdmin
    .from("events")
    .select("id, nama, jenis, deskripsi, lokasi, tanggal, status, checkin_code")
    .eq("checkin_code", code.toUpperCase())
    .single();

  if (error || !event) {
    return NextResponse.json({ error: "Kegiatan tidak ditemukan" }, { status: 404 });
  }

  if (event.status === "Dibatalkan") {
    return NextResponse.json({ error: "Kegiatan ini telah dibatalkan" }, { status: 400 });
  }

  if (event.status === "Selesai") {
    return NextResponse.json({ error: "Kegiatan ini telah selesai" }, { status: 400 });
  }

  return NextResponse.json({ event });
}
