import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getUserRole, canDelete } from "@/lib/roles";
import { NextRequest, NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const role = await getUserRole(supabase);

  if (!role || role === "viewer") {
    return NextResponse.json(
      { error: "Tidak memiliki akses untuk mengedit" },
      { status: 403 }
    );
  }

  const body = await request.json();

  // Only allow specific fields to be updated
  const allowedFields = [
    "no_hp",
    "pic",
    "status_dpt",
    "sudah_dikontak",
    "masuk_grup",
    "vote",
    "referral_name",
  ];
  const updates: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (key in body) {
      updates[key] = body[key];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "Tidak ada data untuk diperbarui" },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("members")
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
      { error: "Hanya admin yang dapat menghapus anggota" },
      { status: 403 }
    );
  }

  // Delete related records using service role client (bypasses RLS)
  await supabaseAdmin
    .from("event_attendance")
    .delete()
    .eq("member_id", id);

  await supabaseAdmin
    .from("event_registrations")
    .delete()
    .eq("member_id", id);

  // Clear referred_by references pointing to this member
  await supabaseAdmin
    .from("members")
    .update({ referred_by: null })
    .eq("referred_by", id);

  // Delete the member
  const { error } = await supabaseAdmin
    .from("members")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
