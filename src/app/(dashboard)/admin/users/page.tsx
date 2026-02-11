"use client";

import { useState, useEffect } from "react";
import { useRole } from "@/lib/RoleContext";
import { useToast } from "@/components/Toast";
import { Shield, Loader2, Users, AlertTriangle } from "lucide-react";

interface UserWithRole {
  user_id: string;
  email: string;
  role: string;
  created_at: string;
  last_sign_in_at: string | null;
}

export default function AdminUsersPage() {
  const { canManageUsers, loading: roleLoading } = useRole();
  const { showToast } = useToast();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!roleLoading && canManageUsers) {
      fetchUsers();
    } else if (!roleLoading && !canManageUsers) {
      setLoading(false);
    }
  }, [roleLoading, canManageUsers]);

  async function fetchUsers() {
    setLoading(true);
    try {
      const response = await fetch("/api/roles");
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Gagal memuat data pengguna");
      }
      const data = await response.json();
      setUsers(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal memuat data pengguna";
      showToast(message, "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleRoleChange(userId: string, newRole: string) {
    setUpdatingUserId(userId);
    try {
      const response = await fetch("/api/roles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, role: newRole }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Gagal mengubah role");
      }

      // Update local state
      setUsers((prev) =>
        prev.map((u) =>
          u.user_id === userId ? { ...u, role: newRole } : u
        )
      );
      showToast("Role berhasil diubah", "success");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal mengubah role";
      showToast(message, "error");
    } finally {
      setUpdatingUserId(null);
    }
  }

  function formatDate(dateString: string | null): string {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getRoleBadgeClasses(role: string): string {
    switch (role) {
      case "admin":
        return "bg-[#84303F]/10 text-[#84303F]";
      case "koordinator":
        return "bg-[#0B27BC]/10 text-[#0B27BC]";
      default:
        return "bg-gray-100 text-gray-600";
    }
  }

  // Loading state while checking role
  if (roleLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#0B27BC]" />
          <p className="text-sm text-muted-foreground">Memuat data...</p>
        </div>
      </div>
    );
  }

  // Access denied
  if (!canManageUsers) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-center px-4">
          <div className="p-3 rounded-full bg-red-100">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">
            Akses Ditolak
          </h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            Anda tidak memiliki izin untuk mengakses halaman ini. Hanya admin
            yang dapat mengelola pengguna.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0B27BC] text-white shadow-lg">
        <div className="px-4 sm:px-6 py-3">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-[#FE8DA1]" />
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-white">
                Manajemen Pengguna
              </h1>
              <p className="text-xs text-white/70">
                Kelola role dan akses pengguna
              </p>
            </div>
          </div>
        </div>
        <div className="h-1 bg-gradient-to-r from-[#fcb7c3] via-[#FE8DA1] to-[#fcb7c3]" />
      </header>

      <div className="px-4 sm:px-6 py-6 space-y-6">
        {/* Summary card */}
        <div className="flex items-center gap-4">
          <div className="bg-white rounded-xl border border-border shadow-sm p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#0B27BC]/10">
              <Users className="w-5 h-5 text-[#0B27BC]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {users.length}
              </p>
              <p className="text-xs text-muted-foreground">Total Pengguna</p>
            </div>
          </div>
        </div>

        {/* Users table */}
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-gray-50/80">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 w-12">
                    #
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">
                    Email
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">
                    Role
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">
                    Terdaftar
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">
                    Login Terakhir
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Users className="w-8 h-8 text-gray-300" />
                        <p className="text-sm text-muted-foreground">
                          Belum ada pengguna terdaftar
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  users.map((user, index) => (
                    <tr
                      key={user.user_id}
                      className="border-b border-border last:border-b-0 hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-4 py-3 text-gray-500">{index + 1}</td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-foreground">
                          {user.email}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`hidden sm:inline-block text-xs px-2 py-0.5 rounded-full font-medium capitalize ${getRoleBadgeClasses(user.role)}`}
                          >
                            {user.role}
                          </span>
                          <select
                            value={user.role}
                            onChange={(e) =>
                              handleRoleChange(user.user_id, e.target.value)
                            }
                            disabled={updatingUserId === user.user_id}
                            className="px-2 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC] bg-white disabled:opacity-50 disabled:cursor-wait capitalize"
                          >
                            <option value="admin">Admin</option>
                            <option value="koordinator">Koordinator</option>
                            <option value="viewer">Viewer</option>
                          </select>
                          {updatingUserId === user.user_id && (
                            <Loader2 className="w-4 h-4 animate-spin text-[#0B27BC]" />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                        {formatDate(user.created_at)}
                      </td>
                      <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                        {formatDate(user.last_sign_in_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
