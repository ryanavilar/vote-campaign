import { SupabaseClient } from "@supabase/supabase-js";

interface AuditParams {
  memberId: string;
  userId: string | null;
  userEmail: string | null;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  action: "create" | "update" | "delete" | "assign" | "unassign";
}

export async function logMemberAudit(
  supabase: SupabaseClient,
  params: AuditParams
) {
  try {
    await supabase.from("member_audit_log").insert({
      member_id: params.memberId,
      user_id: params.userId,
      user_email: params.userEmail,
      field: params.field,
      old_value: params.oldValue != null ? String(params.oldValue) : null,
      new_value: params.newValue != null ? String(params.newValue) : null,
      action: params.action,
    });
  } catch {
    // Audit logging should never break the main operation
    console.error("Failed to log audit entry:", params);
  }
}

export async function logMemberAuditBatch(
  supabase: SupabaseClient,
  entries: AuditParams[]
) {
  if (entries.length === 0) return;
  try {
    await supabase.from("member_audit_log").insert(
      entries.map((params) => ({
        member_id: params.memberId,
        user_id: params.userId,
        user_email: params.userEmail,
        field: params.field,
        old_value: params.oldValue != null ? String(params.oldValue) : null,
        new_value: params.newValue != null ? String(params.newValue) : null,
        action: params.action,
      }))
    );
  } catch {
    console.error("Failed to log audit batch:", entries.length, "entries");
  }
}
