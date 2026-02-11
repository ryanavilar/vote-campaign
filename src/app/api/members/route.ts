import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getUserRole, canEdit } from "@/lib/roles";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("members")
    .select("*")
    .order("no", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();

  const role = await getUserRole(supabase);
  if (!canEdit(role)) {
    return NextResponse.json(
      { error: "Tidak memiliki akses untuk menambah anggota" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { nama, angkatan, no_hp, pic, referred_by } = body;

  if (!nama || !angkatan) {
    return NextResponse.json(
      { error: "Nama dan angkatan wajib diisi" },
      { status: 400 }
    );
  }

  // Get the next "no" value
  const { data: maxNoRow } = await supabase
    .from("members")
    .select("no")
    .order("no", { ascending: false })
    .limit(1)
    .single();

  const nextNo = (maxNoRow?.no || 0) + 1;

  const { data, error } = await supabase
    .from("members")
    .insert({
      no: nextNo,
      nama,
      angkatan: Number(angkatan),
      no_hp: no_hp || "",
      pic: pic || null,
      referred_by: referred_by || null,
      status_dpt: null,
      sudah_dikontak: null,
      masuk_grup: null,
      vote: null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createSupabaseServerClient();

  const role = await getUserRole(supabase);
  if (!canEdit(role)) {
    return NextResponse.json(
      { error: "Tidak memiliki akses untuk mengubah data" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { id, field, value } = body;

  const allowedFields = [
    "status_dpt",
    "sudah_dikontak",
    "masuk_grup",
    "vote",
    "pic",
    "referred_by",
    "nama",
    "angkatan",
    "no_hp",
  ];

  if (!allowedFields.includes(field)) {
    return NextResponse.json({ error: "Invalid field" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("members")
    .update({ [field]: value })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
