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
  const { nama, angkatan, no_hp, pic, referral_name } = body;

  if (!nama || !angkatan) {
    return NextResponse.json(
      { error: "Nama dan angkatan wajib diisi" },
      { status: 400 }
    );
  }

  // Auto-match referred_by from referral_name
  let referredBy: string | null = null;
  if (referral_name?.trim()) {
    const { data: referrer } = await supabase
      .from("members")
      .select("id")
      .ilike("nama", referral_name.trim())
      .limit(1);
    if (referrer && referrer.length > 0) {
      referredBy = referrer[0].id;
    }
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
      referral_name: referral_name?.trim() || null,
      referred_by: referredBy,
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
    "referral_name",
    "nama",
    "angkatan",
    "no_hp",
  ];

  if (!allowedFields.includes(field)) {
    return NextResponse.json({ error: "Invalid field" }, { status: 400 });
  }

  // When referral_name changes, auto-match referred_by
  const updateData: Record<string, unknown> = { [field]: value };
  if (field === "referral_name") {
    const trimmed = typeof value === "string" ? value.trim() : "";
    if (trimmed) {
      const { data: referrer } = await supabase
        .from("members")
        .select("id")
        .ilike("nama", trimmed)
        .neq("id", id)
        .limit(1);
      updateData.referred_by = referrer && referrer.length > 0 ? referrer[0].id : null;
    } else {
      updateData.referred_by = null;
    }
  }

  const { data, error } = await supabase
    .from("members")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
