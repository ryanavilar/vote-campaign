"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useRole } from "@/lib/RoleContext";
import { useToast } from "@/components/Toast";
import { formatNum } from "@/lib/format";
import type { Member, StatusValue } from "@/lib/types";
import { DataTable } from "@/components/DataTable";
import {
  Search,
  Loader2,
  Plus,
  Crosshair,
  GraduationCap,
  ClipboardCheck,
  UserCheck,
  Vote,
  ChevronUp,
} from "lucide-react";

interface AlumniSearchResult {
  id: string;
  nama: string;
  angkatan: number;
  kelanjutan_studi: string | null;
  program_studi: string | null;
  members: {
    id: string;
    nama: string;
    campaigner_targets: { user_id: string }[];
  }[];
}

export default function TargetPage() {
  const { canEdit: userCanEdit, role, userId, loading: roleLoading } = useRole();
  const { showToast } = useToast();
  const router = useRouter();

  // My targets
  const [targets, setTargets] = useState<Member[]>([]);
  const [loadingTargets, setLoadingTargets] = useState(true);
  const [attendanceCounts, setAttendanceCounts] = useState<Record<string, number>>({});

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchAngkatan, setSearchAngkatan] = useState("");
  const [searchResults, setSearchResults] = useState<AlumniSearchResult[]>([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searching, setSearching] = useState(false);
  const [searchPage, setSearchPage] = useState(1);
  const [showSearch, setShowSearch] = useState(false);

  // Adding
  const [addingId, setAddingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Target list filter
  const [targetSearch, setTargetSearch] = useState("");
  const [targetFilterField, setTargetFilterField] = useState("status_dpt");
  const [targetFilterValue, setTargetFilterValue] = useState("all");

  // Fetch targets
  const fetchTargets = useCallback(async () => {
    setLoadingTargets(true);
    try {
      const [targetsRes, attendanceRes] = await Promise.all([
        fetch("/api/targets"),
        supabase.from("event_attendance").select("member_id"),
      ]);

      if (targetsRes.ok) {
        const data = await targetsRes.json();
        setTargets(data);
      }

      if (!attendanceRes.error && attendanceRes.data) {
        const counts: Record<string, number> = {};
        for (const row of attendanceRes.data) {
          counts[row.member_id] = (counts[row.member_id] || 0) + 1;
        }
        setAttendanceCounts(counts);
      }
    } catch {
      showToast("Gagal memuat data target", "error");
    }
    setLoadingTargets(false);
  }, [showToast]);

  useEffect(() => {
    if (roleLoading) return;
    fetchTargets();
  }, [fetchTargets, roleLoading]);

  // Search alumni
  const searchAlumni = useCallback(
    async (query: string, angkatan: string, page: number) => {
      if (query.length < 2 && !angkatan) {
        setSearchResults([]);
        setSearchTotal(0);
        return;
      }
      setSearching(true);
      try {
        const params = new URLSearchParams();
        if (query.length >= 2) params.set("q", query);
        if (angkatan) params.set("angkatan", angkatan);
        params.set("page", String(page));
        params.set("limit", "20");

        const res = await fetch(`/api/alumni/search?${params}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.data);
          setSearchTotal(data.total);
        }
      } catch {
        showToast("Gagal mencari alumni", "error");
      }
      setSearching(false);
    },
    [showToast]
  );

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (showSearch) {
        setSearchPage(1);
        searchAlumni(searchQuery, searchAngkatan, 1);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchAngkatan, showSearch, searchAlumni]);

  // Add target — optimistic update
  const handleAddTarget = async (alumniId: string) => {
    setAddingId(alumniId);
    try {
      const res = await fetch("/api/targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alumni_id: alumniId }),
      });

      const data = await res.json();

      if (!res.ok) {
        showToast(data.error || "Gagal menambah target", "error");
        return;
      }

      // Optimistically add the new member to targets state
      if (data.member) {
        setTargets((prev) => [...prev, data.member].sort((a, b) => a.no - b.no));
      }

      showToast(
        data.action === "created"
          ? "Alumni ditambahkan sebagai target baru"
          : "Anggota ditambahkan ke daftar target",
        "success"
      );

      // Only refresh search results for badge update
      await searchAlumni(searchQuery, searchAngkatan, searchPage);
    } catch {
      showToast("Terjadi kesalahan jaringan", "error");
    }
    setAddingId(null);
  };

  // Remove target — optimistic update
  const handleRemoveTarget = async (memberId: string) => {
    setRemovingId(memberId);
    // Optimistically remove from state
    const previousTargets = targets;
    setTargets((prev) => prev.filter((m) => m.id !== memberId));

    try {
      const res = await fetch("/api/targets", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_id: memberId }),
      });

      if (res.ok) {
        showToast("Target berhasil dihapus dari daftar", "success");
      } else {
        // Restore on error
        setTargets(previousTargets);
        const data = await res.json();
        showToast(data.error || "Gagal menghapus target", "error");
      }
    } catch {
      setTargets(previousTargets);
      showToast("Terjadi kesalahan jaringan", "error");
    }
    setRemovingId(null);
  };

  // Update member status via API (for audit logging)
  const updateMember = useCallback(
    async (id: string, field: string, value: StatusValue) => {
      // Optimistic update
      setTargets((prev) =>
        prev.map((m) => (m.id === id ? { ...m, [field]: value } : m))
      );

      try {
        const res = await fetch("/api/members", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, field, value }),
        });

        if (!res.ok) {
          fetchTargets();
          showToast("Gagal mengupdate status", "error");
        }
      } catch {
        fetchTargets();
        showToast("Gagal mengupdate status", "error");
      }
    },
    [fetchTargets, showToast]
  );

  // Target IDs for quick lookup
  const targetMemberIds = useMemo(
    () => new Set(targets.map((t) => t.id)),
    [targets]
  );

  // Get alumni status relative to current user
  const getAlumniStatus = (alumni: AlumniSearchResult) => {
    if (!alumni.members || alumni.members.length === 0) {
      return "available"; // No linked member — fresh
    }
    const member = alumni.members[0];
    const isMyTarget = member.campaigner_targets?.some(
      (ct) => ct.user_id === userId
    );
    if (isMyTarget) return "mine";
    return "available"; // Available even if others target it
  };

  // Target stats
  const targetStats = useMemo(() => {
    const total = targets.length;
    const dpt = targets.filter((m) => m.status_dpt === "Sudah").length;
    const grup = targets.filter((m) => m.masuk_grup === "Sudah").length;
    const vote = targets.filter((m) => m.vote === "Sudah").length;
    return { total, dpt, grup, vote };
  }, [targets]);

  // Filter targets
  const filteredTargets = useMemo(() => {
    return targets.filter((m) => {
      const q = targetSearch.toLowerCase();
      const matchesSearch =
        !q ||
        m.nama.toLowerCase().includes(q) ||
        (m.no_hp && m.no_hp.includes(targetSearch));

      const statusKey = targetFilterField as keyof Member;
      const matchesStatus =
        targetFilterValue === "all" ||
        (targetFilterValue === "empty" && (m[statusKey] === null || m[statusKey] === "")) ||
        m[statusKey] === targetFilterValue;

      return matchesSearch && matchesStatus;
    });
  }, [targets, targetSearch, targetFilterField, targetFilterValue]);

  // Angkatan list from search results
  const angkatanList = useMemo(() => {
    const set = new Set<number>();
    for (let i = 1; i <= 35; i++) set.add(i);
    return Array.from(set).sort((a, b) => a - b);
  }, []);

  if (roleLoading || loadingTargets) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#0B27BC]" />
          <p className="text-sm text-muted-foreground">Memuat data target...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0B27BC] text-white shadow-lg">
        <div className="px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Crosshair className="w-5 h-5 text-[#FE8DA1]" />
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-white">Target Saya</h1>
                <p className="text-xs text-white/70">
                  {formatNum(targetStats.total)} target
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-[#0B27BC] bg-white rounded-lg hover:bg-gray-100 transition-colors"
            >
              {showSearch ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Tutup Pencarian</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Tambah Target</span>
                  <span className="sm:hidden">Tambah</span>
                </>
              )}
            </button>
          </div>
        </div>
        <div className="h-1 bg-gradient-to-r from-[#fcb7c3] via-[#FE8DA1] to-[#fcb7c3]" />
      </header>

      <div className="px-4 sm:px-6 py-6 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Target", value: targetStats.total, icon: Crosshair, color: "text-[#0B27BC]", bg: "bg-[#0B27BC]/10" },
            { label: "DPT", value: targetStats.dpt, icon: ClipboardCheck, color: "text-emerald-700", bg: "bg-emerald-50" },
            { label: "Grup", value: targetStats.grup, icon: UserCheck, color: "text-[#0B27BC]", bg: "bg-[#0B27BC]/10" },
            { label: "Vote", value: targetStats.vote, icon: Vote, color: "text-[#84303F]", bg: "bg-[#84303F]/10" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-border p-3 shadow-sm text-center">
              <div className={`inline-flex p-1.5 rounded-lg ${s.bg} mb-1`}>
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <p className="text-xl font-bold text-foreground">{formatNum(s.value)}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Search Alumni Section */}
        {showSearch && (
          <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-gray-50/80">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-[#84303F]" />
                <h3 className="text-sm font-semibold text-foreground">Cari Alumni</h3>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Cari dari {formatNum(10952)} data alumni, lalu tambahkan sebagai target
              </p>
            </div>

            <div className="px-4 py-3 border-b border-border space-y-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Ketik nama alumni (min 2 huruf)..."
                    className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC]"
                    autoFocus
                  />
                </div>
                <select
                  value={searchAngkatan}
                  onChange={(e) => setSearchAngkatan(e.target.value)}
                  className="px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC] bg-white"
                >
                  <option value="">Semua TN</option>
                  {angkatanList.map((a) => (
                    <option key={a} value={a}>TN {a}</option>
                  ))}
                </select>
              </div>
              {searchTotal > 0 && (
                <p className="text-xs text-muted-foreground">
                  {formatNum(searchTotal)} hasil ditemukan
                </p>
              )}
            </div>

            {/* Search Results */}
            <div className="max-h-[400px] overflow-y-auto divide-y divide-border">
              {searching ? (
                <div className="px-4 py-8 text-center">
                  <Loader2 className="w-5 h-5 animate-spin text-[#0B27BC] mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Mencari...</p>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <GraduationCap className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {searchQuery.length >= 2 || searchAngkatan
                      ? "Tidak ada alumni ditemukan"
                      : "Ketik nama alumni untuk mencari"}
                  </p>
                </div>
              ) : (
                searchResults.map((alumni) => {
                  const status = getAlumniStatus(alumni);
                  const isAdding = addingId === alumni.id;

                  return (
                    <div
                      key={alumni.id}
                      className="px-4 py-3 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-[#84303F]/10 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-[#84303F] uppercase">
                            {alumni.nama.charAt(0)}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {alumni.nama}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            TN {alumni.angkatan}
                            {alumni.kelanjutan_studi
                              ? ` · ${alumni.kelanjutan_studi}`
                              : ""}
                          </p>
                        </div>
                      </div>

                      {status === "mine" ? (
                        <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full shrink-0">
                          Target Saya
                        </span>
                      ) : (
                        <button
                          onClick={() => handleAddTarget(alumni.id)}
                          disabled={isAdding}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#0B27BC] rounded-lg hover:bg-[#091fa0] transition-colors disabled:opacity-50 shrink-0"
                        >
                          {isAdding ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Plus className="w-3 h-3" />
                          )}
                          Tambah
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Load more */}
            {searchResults.length > 0 && searchResults.length < searchTotal && (
              <div className="px-4 py-3 border-t border-border text-center">
                <button
                  onClick={() => {
                    const next = searchPage + 1;
                    setSearchPage(next);
                    searchAlumni(searchQuery, searchAngkatan, next);
                  }}
                  className="text-xs font-medium text-[#0B27BC] hover:underline"
                >
                  Muat lebih banyak...
                </button>
              </div>
            )}
          </div>
        )}

        {/* Target filters */}
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-4 py-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={targetSearch}
                  onChange={(e) => setTargetSearch(e.target.value)}
                  placeholder="Cari target..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC]"
                />
              </div>
              <select
                value={targetFilterField}
                onChange={(e) => {
                  setTargetFilterField(e.target.value);
                  setTargetFilterValue("all");
                }}
                className="px-3 py-2 text-sm border border-border rounded-lg bg-white"
              >
                <option value="status_dpt">DPT</option>
                <option value="sudah_dikontak">Dikontak</option>
                <option value="masuk_grup">Grup</option>
                <option value="vote">Vote</option>
              </select>
              <select
                value={targetFilterValue}
                onChange={(e) => setTargetFilterValue(e.target.value)}
                className="px-3 py-2 text-sm border border-border rounded-lg bg-white"
              >
                <option value="all">Semua</option>
                <option value="Sudah">Sudah</option>
                <option value="Belum">Belum</option>
                <option value="empty">Kosong</option>
              </select>
            </div>
          </div>
        </div>

        {/* My Targets Table */}
        <DataTable
          data={filteredTargets}
          attendanceCounts={attendanceCounts}
          onUpdate={updateMember}
          onRowClick={(id) => router.push(`/anggota/${id}?from=target`)}
          onDelete={handleRemoveTarget}
          deletingId={removingId}
          totalCount={targets.length}
          title="Daftar Target"
        />
      </div>
    </div>
  );
}
