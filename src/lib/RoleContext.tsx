"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { type UserRole, canEdit, canDelete, canManageUsers, isSuperAdmin } from "@/lib/roles";

interface RoleContextType {
  role: UserRole;
  canEdit: boolean;
  canDelete: boolean;
  canManageUsers: boolean;
  isSuperAdmin: boolean;
  loading: boolean;
  userEmail: string;
  userName: string;
  userId: string;
}

const RoleContext = createContext<RoleContextType>({
  role: "viewer",
  canEdit: false,
  canDelete: false,
  canManageUsers: false,
  isSuperAdmin: false,
  loading: true,
  userEmail: "",
  userName: "",
  userId: "",
});

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<UserRole>("viewer");
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [userId, setUserId] = useState("");

  useEffect(() => {
    async function fetchRole() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      setUserEmail(user.email || "");
      setUserName(user.user_metadata?.name || user.user_metadata?.full_name || "");
      setUserId(user.id);

      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      setRole((data?.role as UserRole) || "viewer");
      setLoading(false);
    }

    fetchRole();
  }, []);

  return (
    <RoleContext.Provider
      value={{
        role,
        canEdit: canEdit(role),
        canDelete: canDelete(role),
        canManageUsers: canManageUsers(role),
        isSuperAdmin: isSuperAdmin(role),
        loading,
        userEmail,
        userName,
        userId,
      }}
    >
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  return useContext(RoleContext);
}
