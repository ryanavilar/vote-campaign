"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { type UserRole, canEdit, canDelete, canManageUsers } from "@/lib/roles";

interface RoleContextType {
  role: UserRole;
  canEdit: boolean;
  canDelete: boolean;
  canManageUsers: boolean;
  loading: boolean;
  userEmail: string;
  userId: string;
}

const RoleContext = createContext<RoleContextType>({
  role: "viewer",
  canEdit: false,
  canDelete: false,
  canManageUsers: false,
  loading: true,
  userEmail: "",
  userId: "",
});

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<UserRole>("viewer");
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [userId, setUserId] = useState("");

  useEffect(() => {
    async function fetchRole() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      setUserEmail(user.email || "");
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
        loading,
        userEmail,
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
