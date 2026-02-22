"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRole } from "@/lib/RoleContext";
import { useToast } from "@/components/Toast";
import { formatNum } from "@/lib/format";
import {
  Loader2,
  Users,
  UserPlus,
  Search,
  Filter,
  X,
  Check,
  AlertTriangle,
} from "lucide-react";

interface CampaignerUser {
  user_id: string;
  email: string;
}

interface AssignmentMember {
  id: string;
  nama: string;
  angkatan: number;
  no_hp: string;
  campaigner_targets?: { user_id: string }[];
}

type Selection =
  | { type: "unassigned" }
  | { type: "campaigner"; id: string; email: string };

export default function AdminAssignmentsPage() {
  const { canManageUsers, loading: roleLoading } = useRole();
  const { showToast } = useToast();

  const [members, setMembers] = useState<AssignmentMember[]>([]);
  const [campaigners, setCampaigners] = useState<CampaignerUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [selection, setSelection] = useState<Selection | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalSearch, setModalSearch] = useState("");
  const [modalAngkatan, setModalAngkatan] = useState<string>("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(
    new Set()
  );

  // ── Data fetching ───────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/assignments");
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Gagal memuat data penugasan");
      }
      const data = await response.json();
      setMembers(data.members ?? []);
      setCampaigners(data.campaigners ?? []);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal memuat data penugasan";
      showToast(message, "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (!roleLoading && canManageUsers) {
      fetchData();
    } else if (!roleLoading && !canManageUsers) {
      setLoading(false);
    }
  }, [roleLoading, canManageUsers, fetchData]);

  // ── Derived data ────────────────────────────────────────────────
  const assignmentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    let unassigned = 0;
    for (const m of members) {
      const targets = m.campaigner_targets || [];
      if (targets.length > 0) {
        for (const t of targets) {
          counts[t.user_id] = (counts[t.user_id] || 0) + 1;
        }
      } else {
        unassigned++;
      }
    }
    return { counts, unassigned };
  }, [members]);

  const unassignedMembers = useMemo(
    () => members.filter((m) => {
      const targets = m.campaigner_targets || [];
      return targets.length === 0;
    }),
    [members]
  );

  const selectedMembers = useMemo(() => {
    if (!selection) return [];
    if (selection.type === "unassigned") {
      return members.filter((m) => {
        const targets = m.campaigner_targets || [];
        return targets.length === 0;
      });
    }
    return members.filter((m) => {
      const targets = m.campaigner_targets || [];
      return targets.some((t) => t.user_id === selection.id);
    });
  }, [members, selection]);

  // Modal: available unassigned members with search + angkatan filter
  const angkatanOptions = useMemo(() => {
    const set = new Set<number>();
    for (const m of unassignedMembers) {
      set.add(m.angkatan);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [unassignedMembers]);

  const filteredModalMembers = useMemo(() => {
    let list = unassignedMembers;
    if (modalSearch.trim()) {
      const q = modalSearch.toLowerCase();
      list = list.filter(
        (m) =>
          m.nama.toLowerCase().includes(q) ||
          m.no_hp.includes(q)
      );
    }
    if (modalAngkatan) {
      list = list.filter((m) => m.angkatan === Number(modalAngkatan));
    }
    return list;
  }, [unassignedMembers, modalSearch, modalAngkatan]);

  const allFilteredSelected = useMemo(() => {
    if (filteredModalMembers.length === 0) return false;
    return filteredModalMembers.every((m) => selectedMemberIds.has(m.id));
  }, [filteredModalMembers, selectedMemberIds]);

  // ── Actions ─────────────────────────────────────────────────────
  async function handleAssign() {
    if (
      !selection ||
      selection.type !== "campaigner" ||
      selectedMemberIds.size === 0
    )
      return;

    setActionLoading(true);
    try {
      const response = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaigner_id: selection.id,
          member_ids: Array.from(selectedMemberIds),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Gagal menugaskan anggota");
      }

      showToast(
        `${selectedMemberIds.size} anggota berhasil ditugaskan`,
        "success"
      );
      setShowModal(false);
      setSelectedMemberIds(new Set());
      setModalSearch("");
      setModalAngkatan("");
      await fetchData();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal menugaskan anggota";
      showToast(message, "error");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleUnassign(memberIds: string[]) {
    if (memberIds.length === 0) return;

    const campaignerId = selection?.type === "campaigner" ? selection.id : undefined;

    setActionLoading(true);
    try {
      const response = await fetch("/api/assignments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_ids: memberIds, campaigner_id: campaignerId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Gagal menghapus penugasan");
      }

      showToast("Penugasan berhasil dihapus", "success");
      await fetchData();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal menghapus penugasan";
      showToast(message, "error");
    } finally {
      setActionLoading(false);
    }
  }

  function openModal() {
    setSelectedMemberIds(new Set());
    setModalSearch("");
    setModalAngkatan("");
    setShowModal(true);
  }

  function toggleMember(id: string) {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    if (allFilteredSelected) {
      setSelectedMemberIds((prev) => {
        const next = new Set(prev);
        for (const m of filteredModalMembers) {
          next.delete(m.id);
        }
        return next;
      });
    } else {
      setSelectedMemberIds((prev) => {
        const next = new Set(prev);
        for (const m of filteredModalMembers) {
          next.add(m.id);
        }
        return next;
      });
    }
  }

  // ── Loading state ───────────────────────────────────────────────
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

  // ── Access denied ───────────────────────────────────────────────
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
            yang dapat mengelola penugasan.
          </p>
        </div>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className="bg-background min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0B27BC] text-white shadow-lg">
        <div className="px-4 sm:px-6 py-3">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-[#FE8DA1]" />
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-white">
                Penugasan Tim Sukses
              </h1>
              <p className="text-xs text-white/70">
                Kelola penugasan anggota ke Tim Sukses
              </p>
            </div>
          </div>
        </div>
        <div className="h-1 bg-gradient-to-r from-[#fcb7c3] via-[#FE8DA1] to-[#fcb7c3]" />
      </header>

      {/* Two-panel layout */}
      <div className="px-4 sm:px-6 py-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* ── Left panel: Tim Sukses list ─────────────────────── */}
          <div className="md:w-80 shrink-0">
            <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-gray-50/80">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#0B27BC]" />
                  Daftar Tim Sukses
                </h2>
              </div>

              <div className="divide-y divide-border">
                {/* Unassigned option */}
                <button
                  onClick={() => setSelection({ type: "unassigned" })}
                  className={`w-full text-left px-4 py-3 transition-colors hover:bg-gray-50 ${
                    selection?.type === "unassigned"
                      ? "bg-[#0B27BC]/5 border-l-2 border-l-[#0B27BC]"
                      : "border-l-2 border-l-transparent"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                        <Users className="w-4 h-4 text-gray-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          Belum Ditugaskan
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Anggota tanpa Tim Sukses
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-white bg-gray-400 px-2 py-0.5 rounded-full">
                      {formatNum(assignmentCounts.unassigned)}
                    </span>
                  </div>
                </button>

                {/* Tim Sukses list */}
                {campaigners.map((c) => {
                  const isActive =
                    selection?.type === "campaigner" && selection.id === c.user_id;
                  const count = assignmentCounts.counts[c.user_id] || 0;

                  return (
                    <button
                      key={c.user_id}
                      onClick={() =>
                        setSelection({
                          type: "campaigner",
                          id: c.user_id,
                          email: c.email,
                        })
                      }
                      className={`w-full text-left px-4 py-3 transition-colors hover:bg-gray-50 ${
                        isActive
                          ? "bg-[#0B27BC]/5 border-l-2 border-l-[#0B27BC]"
                          : "border-l-2 border-l-transparent"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-[#0B27BC]/10 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-[#0B27BC] uppercase">
                              {c.email.charAt(0)}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-foreground truncate">
                            {c.email}
                          </p>
                        </div>
                        <span className="text-xs font-semibold text-white bg-[#0B27BC] px-2 py-0.5 rounded-full shrink-0 ml-2">
                          {formatNum(count)}
                        </span>
                      </div>
                    </button>
                  );
                })}

                {campaigners.length === 0 && (
                  <div className="px-4 py-8 text-center">
                    <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Belum ada Tim Sukses
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Right panel: Member list ────────────────────────── */}
          <div className="flex-1 min-w-0">
            {!selection ? (
              <div className="bg-white rounded-xl border border-border shadow-sm flex items-center justify-center py-20">
                <div className="text-center">
                  <Users className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Pilih Tim Sukses atau &quot;Belum Ditugaskan&quot; untuk
                    melihat anggota
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
                {/* Right panel header */}
                <div className="px-4 py-3 border-b border-border bg-gray-50/80">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-semibold text-foreground">
                        {selection.type === "unassigned"
                          ? "Belum Ditugaskan"
                          : selection.email}
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        {selectedMembers.length} anggota
                        {selection.type === "campaigner"
                          ? " ditugaskan"
                          : " belum ditugaskan"}
                      </p>
                    </div>
                    {selection.type === "campaigner" && (
                      <button
                        onClick={openModal}
                        disabled={actionLoading}
                        className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-[#0B27BC] rounded-lg hover:bg-[#091fa0] transition-colors disabled:opacity-50"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        Tambah Anggota
                      </button>
                    )}
                  </div>
                </div>

                {/* Member list */}
                {selectedMembers.length === 0 ? (
                  <div className="px-4 py-12 text-center">
                    <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {selection.type === "unassigned"
                        ? "Semua anggota sudah ditugaskan"
                        : "Belum ada anggota ditugaskan ke Tim Sukses ini"}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {selectedMembers.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between px-4 py-3 hover:bg-gray-50/50 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-[#FE8DA1]/10 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-[#84303F] uppercase">
                              {m.nama.charAt(0)}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {m.nama}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Angkatan {m.angkatan}
                              {m.no_hp ? ` · ${m.no_hp}` : ""}
                            </p>
                          </div>
                        </div>
                        {selection?.type === "campaigner" && (
                          <button
                            onClick={() => handleUnassign([m.id])}
                            disabled={actionLoading}
                            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                            title="Hapus Penugasan"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Tambah Anggota Modal ──────────────────────────────────── */}
      {showModal && selection?.type === "campaigner" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowModal(false)}
          />

          {/* Modal */}
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
            {/* Modal header */}
            <div className="px-4 py-3 border-b border-border shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-[#0B27BC]" />
                    Tambah Anggota
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Tugaskan ke {selection.email}
                  </p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="px-4 py-3 border-b border-border shrink-0 space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  placeholder="Cari nama atau nomor HP..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC] bg-white"
                />
              </div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <select
                    value={modalAngkatan}
                    onChange={(e) => setModalAngkatan(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC] bg-white appearance-none"
                  >
                    <option value="">Semua Angkatan</option>
                    {angkatanOptions.map((a) => (
                      <option key={a} value={a}>
                        Angkatan {a}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Select all */}
            <div className="px-4 py-2 border-b border-border shrink-0 bg-gray-50/80">
              <label className="flex items-center gap-2 cursor-pointer">
                <button
                  onClick={toggleSelectAll}
                  className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                    allFilteredSelected
                      ? "bg-[#0B27BC] border-[#0B27BC]"
                      : "border-gray-300 hover:border-[#0B27BC]"
                  }`}
                >
                  {allFilteredSelected && (
                    <Check className="w-3 h-3 text-white" />
                  )}
                </button>
                <span className="text-xs font-medium text-foreground">
                  Pilih Semua ({filteredModalMembers.length})
                </span>
              </label>
            </div>

            {/* Member list */}
            <div className="flex-1 overflow-y-auto divide-y divide-border">
              {filteredModalMembers.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Tidak ada anggota yang tersedia
                  </p>
                </div>
              ) : (
                filteredModalMembers.map((m) => {
                  const isSelected = selectedMemberIds.has(m.id);
                  return (
                    <button
                      key={m.id}
                      onClick={() => toggleMember(m.id)}
                      className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors hover:bg-gray-50 ${
                        isSelected ? "bg-[#0B27BC]/5" : ""
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                          isSelected
                            ? "bg-[#0B27BC] border-[#0B27BC]"
                            : "border-gray-300"
                        }`}
                      >
                        {isSelected && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {m.nama}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Angkatan {m.angkatan}
                          {m.no_hp ? ` · ${m.no_hp}` : ""}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Modal footer */}
            <div className="px-4 py-3 border-t border-border shrink-0 bg-gray-50/80 flex items-center justify-between gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleAssign}
                disabled={selectedMemberIds.size === 0 || actionLoading}
                className="inline-flex items-center gap-2 px-4 py-1.5 text-xs font-medium text-white bg-[#0B27BC] rounded-lg hover:bg-[#091fa0] transition-colors disabled:opacity-50"
              >
                {actionLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <UserPlus className="w-3.5 h-3.5" />
                )}
                Tugaskan {selectedMemberIds.size > 0 ? `${selectedMemberIds.size} anggota` : ""}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
