import type { SupabaseClient } from "@supabase/supabase-js";

export type UserRole = "admin" | "campaigner" | "viewer";

export async function getUserRole(supabase: SupabaseClient): Promise<UserRole> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return "viewer";

  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  return (data?.role as UserRole) || "viewer";
}

export function canEdit(role: UserRole): boolean {
  return role === "admin" || role === "campaigner";
}

export function canDelete(role: UserRole): boolean {
  return role === "admin";
}

export function canManageUsers(role: UserRole): boolean {
  return role === "admin";
}
