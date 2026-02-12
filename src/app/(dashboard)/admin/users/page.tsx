"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRole } from "@/lib/RoleContext";
import { useToast } from "@/components/Toast";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  Shield,
  Loader2,
  Users,
  AlertTriangle,
  Plus,
  Trash2,
  Search,
  X,
  Mail,
  KeyRound,
  Eye,
  EyeOff,
} from "lucide-react";

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
  const [searchQuery, setSearchQuery] = useState("");

  // Invite form state
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("viewer");
  const [inviteLoading, setInviteLoading] = useState(false);

  // Delete state
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Password change state
  const [passwordUserId, setPasswordUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    if (!roleLoading && canManageUsers) {
      fetchUsers();
    } else if (!roleLoading && !canManageUsers) {
      setLoading(false);
    }
  }, [roleLoading, canManageUsers]);

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const q = searchQuery.toLowerCase();
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
    );
  }, [users, searchQuery]);

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

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setInviteLoading(true);
    try {
      const response = await fetch("/api/roles/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Gagal mengundang pengguna");
      }

      showToast(data.message || "Undangan berhasil dikirim", "success");
      setShowInviteForm(false);
      setInviteEmail("");
      setInviteRole("viewer");
      await fetchUsers();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal mengundang pengguna";
      showToast(message, "error");
    } finally {
      setInviteLoading(false);
    }
  }

  async function handleDelete() {
    if (!deleteUserId) return;

    setDeleteLoading(true);
    try {
      const response = await fetch("/api/roles", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: deleteUserId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Gagal menghapus pengguna");
      }

      setUsers((prev) => prev.filter((u) => u.user_id !== deleteUserId));
      showToast("Pengguna berhasil dihapus", "success");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal menghapus pengguna";
      showToast(message, "error");
    } finally {
      setDeleteLoading(false);
      setDeleteUserId(null);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordUserId || !newPassword.trim()) return;

    if (newPassword.length < 6) {
      showToast("Password minimal 6 karakter", "error");
      return;
    }

    setPasswordLoading(true);
    try {
      const response = await fetch("/api/roles/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: passwordUserId,
          new_password: newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Gagal mengubah password");
      }

      showToast("Password berhasil diubah", "success");
      setPasswordUserId(null);
      setNewPassword("");
      setShowNewPassword(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal mengubah password";
      showToast(message, "error");
    } finally {
      setPasswordLoading(false);
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

  const deleteUser = users.find((u) => u.user_id === deleteUserId);

  return (
    <div className="bg-background min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0B27BC] text-white shadow-lg">
        <div className="px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
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
            <button
              onClick={() => setShowInviteForm(!showInviteForm)}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-[#0B27BC] bg-white rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Undang User</span>
              <span className="sm:hidden">Undang</span>
            </button>
          </div>
        </div>
        <div className="h-1 bg-gradient-to-r from-[#fcb7c3] via-[#FE8DA1] to-[#fcb7c3]" />
      </header>

      <div className="px-4 sm:px-6 py-6 space-y-4">
        {/* Invite Form */}
        {showInviteForm && (
          <div className="bg-white rounded-xl border border-border p-4 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#0B27BC]" />
                Undang Pengguna Baru
              </h3>
              <button
                onClick={() => setShowInviteForm(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="email@contoh.com"
                required
                className="flex-1 px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC]"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC] bg-white capitalize"
              >
                <option value="viewer">Viewer</option>
                <option value="koordinator">Koordinator</option>
                <option value="admin">Admin</option>
              </select>
              <button
                type="submit"
                disabled={inviteLoading}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#0B27BC] rounded-lg hover:bg-[#091fa0] transition-colors disabled:opacity-50"
              >
                {inviteLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Mail className="w-4 h-4" />
                )}
                Kirim Undangan
              </button>
            </form>
            <p className="text-xs text-muted-foreground mt-2">
              Email undangan akan dikirim ke alamat di atas.
            </p>
          </div>
        )}

        {/* Summary + Search */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
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
          <div className="relative flex-1 w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari email atau role..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC] bg-white"
            />
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
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 w-24">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Users className="w-8 h-8 text-gray-300" />
                        <p className="text-sm text-muted-foreground">
                          {searchQuery
                            ? "Tidak ada pengguna yang cocok"
                            : "Belum ada pengguna terdaftar"}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user, index) => (
                    <React.Fragment key={user.user_id}>
                    <tr
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
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setPasswordUserId(
                                passwordUserId === user.user_id
                                  ? null
                                  : user.user_id
                              );
                              setNewPassword("");
                              setShowNewPassword(false);
                            }}
                            className={`p-1.5 rounded-lg transition-colors ${
                              passwordUserId === user.user_id
                                ? "text-[#0B27BC] bg-[#0B27BC]/10"
                                : "text-[#0B27BC] hover:bg-[#0B27BC]/10"
                            }`}
                            title="Ubah password"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteUserId(user.user_id)}
                            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                            title="Hapus pengguna"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {/* Password change row */}
                    {passwordUserId === user.user_id && (
                      <tr className="bg-[#0B27BC]/5 border-b border-border">
                        <td colSpan={6} className="px-4 py-3">
                          <form
                            onSubmit={handleResetPassword}
                            className="flex flex-col sm:flex-row items-start sm:items-center gap-3"
                          >
                            <span className="text-xs font-medium text-[#0B27BC] whitespace-nowrap">
                              Password baru untuk {user.email}:
                            </span>
                            <div className="relative flex-1 w-full sm:w-auto">
                              <input
                                type={showNewPassword ? "text" : "password"}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Minimal 6 karakter"
                                required
                                className="w-full px-3 py-1.5 pr-9 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC] bg-white"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setShowNewPassword(!showNewPassword)
                                }
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                              >
                                {showNewPassword ? (
                                  <EyeOff className="w-3.5 h-3.5" />
                                ) : (
                                  <Eye className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="submit"
                                disabled={passwordLoading}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#0B27BC] rounded-lg hover:bg-[#091fa0] transition-colors disabled:opacity-50"
                              >
                                {passwordLoading ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <KeyRound className="w-3 h-3" />
                                )}
                                Simpan
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setPasswordUserId(null);
                                  setNewPassword("");
                                  setShowNewPassword(false);
                                }}
                                className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                              >
                                Batal
                              </button>
                            </div>
                          </form>
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        open={!!deleteUserId}
        title="Hapus Pengguna"
        message={`Apakah Anda yakin ingin menghapus pengguna "${deleteUser?.email || ""}"? Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel="Hapus Pengguna"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteUserId(null)}
        loading={deleteLoading}
      />
    </div>
  );
}
