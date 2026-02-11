import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { members } from "@/lib/data";

export async function POST(request: NextRequest) {
  // Use service role key for seeding
  const authHeader = request.headers.get("authorization");
  const seedKey = process.env.SEED_SECRET_KEY;

  if (!seedKey || authHeader !== `Bearer ${seedKey}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Insert members data
  const rows = members.map((m) => ({
    no: m.no,
    nama: m.nama,
    angkatan: m.angkatan,
    no_hp: m.noHp,
    pic: m.pic || null,
    status_dpt: m.statusDpt || null,
    sudah_dikontak: m.sudahDikontak || null,
    masuk_grup: m.masukGrup || null,
    vote: m.vote || null,
  }));

  const { data, error } = await supabase
    .from("members")
    .upsert(rows, { onConflict: "no" })
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    message: `Seeded ${data.length} members successfully`,
    count: data.length,
  });
}
