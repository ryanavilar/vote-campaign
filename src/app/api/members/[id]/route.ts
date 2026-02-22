import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getUserRole, canDelete } from "@/lib/roles";
import { logMemberAudit, logMemberAuditBatch } from "@/lib/audit";
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

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
    "alumni_id",
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

  // Fetch old values for audit
  const fieldsToSelect = Object.keys(updates).join(", ");
  const { data: oldMember } = await supabaseAdmin
    .from("members")
    .select(fieldsToSelect)
    .eq("id", id)
    .single();

  const { data, error } = await supabaseAdmin
    .from("members")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Audit log: each changed field
  const oldRecord = oldMember as Record<string, unknown> | null;
  const auditEntries = Object.entries(updates)
    .filter(([field, value]) => {
      const oldVal = String(oldRecord?.[field] ?? "");
      const newVal = String(value ?? "");
      return oldVal !== newVal;
    })
    .map(([field, value]) => ({
      memberId: id,
      userId: user?.id || null,
      userEmail: user?.email || null,
      field,
      oldValue: oldRecord ? String(oldRecord[field] ?? "") || null : null,
      newValue: String(value ?? "") || null,
      action: "update" as const,
    }));

  if (auditEntries.length > 0) {
    await logMemberAuditBatch(supabaseAdmin, auditEntries);
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch member info for audit before deleting
  const { data: member } = await supabaseAdmin
    .from("members")
    .select("nama, angkatan")
    .eq("id", id)
    .single();

  // Audit log: member deleted (log before cascade delete removes audit entries)
  if (member) {
    await logMemberAudit(supabaseAdmin, {
      memberId: id,
      userId: user?.id || null,
      userEmail: user?.email || null,
      field: "member",
      oldValue: `${member.nama} (TN${member.angkatan})`,
      newValue: null,
      action: "delete",
    });
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

  // Delete audit log entries (they reference the member)
  await supabaseAdmin
    .from("member_audit_log")
    .delete()
    .eq("member_id", id);

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
