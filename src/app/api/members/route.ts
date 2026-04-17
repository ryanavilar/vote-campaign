import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";
import { getUserRole, canEdit } from "@/lib/roles";
import { logMemberAudit } from "@/lib/audit";
import { NextRequest, NextResponse } from "next/server";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("members")
    .select("*")
    .not("is_non_alumni", "is", true)
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const body = await request.json();
  const { nama, angkatan, no_hp, pic, referral_name, alumni_id } = body;

  if (!nama || !angkatan) {
    return NextResponse.json(
      { error: "Nama dan angkatan wajib diisi" },
      { status: 400 }
    );
  }

  const adminClient = getAdminClient();

  // Duplicate check: if alumni_id provided, check if a member already exists for this alumni
  if (alumni_id) {
    const { data: existingByAlumni } = await adminClient
      .from("members")
      .select("id, nama")
      .eq("alumni_id", alumni_id)
      .limit(1);
    if (existingByAlumni && existingByAlumni.length > 0) {
      return NextResponse.json(
        { error: `Alumni ini sudah terhubung dengan anggota "${existingByAlumni[0].nama}"`, existing_id: existingByAlumni[0].id },
        { status: 409 }
      );
    }
  }

  // Duplicate check: same nama + angkatan (case-insensitive)
  const { data: existingByName } = await adminClient
    .from("members")
    .select("id, nama, angkatan")
    .ilike("nama", nama.trim())
    .eq("angkatan", Number(angkatan))
    .not("is_non_alumni", "is", true)
    .limit(1);
  if (existingByName && existingByName.length > 0) {
    return NextResponse.json(
      { error: `Anggota "${existingByName[0].nama}" (TN${existingByName[0].angkatan}) sudah terdaftar`, existing_id: existingByName[0].id },
      { status: 409 }
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
      alumni_id: alumni_id || null,
      status_dpt: null,
      sudah_dikontak: null,
      masuk_grup: null,
      isi_form_dpt: null,
      registrasi_website_dpt: null,
      vote: null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Audit log: member created
  await logMemberAudit(adminClient, {
    memberId: data.id,
    userId: user?.id || null,
    userEmail: user?.email || null,
    field: "member",
    oldValue: null,
    newValue: `${nama} (TN${angkatan})`,
    action: "create",
  });

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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const body = await request.json();
  const { id, field, value } = body;

  const allowedFields = [
    "status_dpt",
    "sudah_dikontak",
    "masuk_grup",
    "isi_form_dpt",
    "registrasi_website_dpt",
    "vote",
    "pic",
    "referral_name",
    "nama",
    "angkatan",
    "no_hp",
    "alt_phones",
    "alumni_id",
  ];

  if (!allowedFields.includes(field)) {
    return NextResponse.json({ error: "Invalid field" }, { status: 400 });
  }

  // Fetch old value for audit
  const adminClient = getAdminClient();
  const { data: oldMember } = await adminClient
    .from("members")
    .select(field)
    .eq("id", id)
    .single();

  const oldValue = oldMember ? String(oldMember[field] ?? "") : null;

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

  // Audit log: field updated
  const newValue = String(value ?? "");
  if (oldValue !== newValue) {
    await logMemberAudit(adminClient, {
      memberId: id,
      userId: user?.id || null,
      userEmail: user?.email || null,
      field,
      oldValue: oldValue || null,
      newValue: newValue || null,
      action: "update",
    });
  }

  return NextResponse.json(data);
}
