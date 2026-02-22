"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useRole } from "@/lib/RoleContext";
import { useToast } from "@/components/Toast";
import { MemberForm } from "@/components/MemberForm";
import { DataTable } from "@/components/DataTable";
import {
  Search,
  Plus,
  Loader2,
  Filter,
  Download,
  Copy,
  GraduationCap,
} from "lucide-react";
import { formatNum } from "@/lib/format";
import type { Member, StatusValue } from "@/lib/types";

export default function AnggotaPage() {
  const [data, setData] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAngkatan, setFilterAngkatan] = useState<string>("all");
  const [filterField, setFilterField] = useState<string>("status_dpt");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [filterDuplicates, setFilterDuplicates] = useState(false);
  const [filterAlumniLink, setFilterAlumniLink] = useState<string>("all");
  const { canEdit: userCanEdit, canManageUsers, role, userId, loading: roleLoading } = useRole();
  const { showToast } = useToast();
  const router = useRouter();

  const [attendanceCounts, setAttendanceCounts] = useState<Record<string, number>>({});

  const fetchMembers = useCallback(async () => {
    setLoading(true);

    const membersPromise = (async () => {
      const { data, error } = await supabase
        .from("members")
        .select("*")
        .order("no", { ascending: true });
      return !error && data ? data : [];
    })();

    const [members, attendanceRes] = await Promise.all([
      membersPromise,
      supabase.from("event_attendance").select("member_id"),
    ]);

    setData(members);
    if (!attendanceRes.error && attendanceRes.data) {
      const counts: Record<string, number> = {};
      for (const row of attendanceRes.data) {
        counts[row.member_id] = (counts[row.member_id] || 0) + 1;
      }
      setAttendanceCounts(counts);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (roleLoading) return;
    fetchMembers();
  }, [fetchMembers, roleLoading]);

  const angkatanList = useMemo(() => {
    return Array.from(new Set(data.map((m) => m.angkatan))).sort((a, b) => a - b);
  }, [data]);

  // Compute duplicate phones across all data
  const duplicatePhones = useMemo(() => {
    const phoneMap = new Map<string, number>();
    for (const m of data) {
      const phone = m.no_hp?.trim();
      if (!phone) continue;
      phoneMap.set(phone, (phoneMap.get(phone) || 0) + 1);
    }
    const dupes = new Set<string>();
    for (const [phone, count] of phoneMap) {
      if (count > 1) dupes.add(phone);
    }
    return dupes;
  }, [data]);

  const duplicateMemberCount = useMemo(() => {
    return data.filter((m) => m.no_hp && duplicatePhones.has(m.no_hp.trim())).length;
  }, [data, duplicatePhones]);

  const alumniLinkCounts = useMemo(() => {
    let linked = 0;
    let unlinked = 0;
    for (const m of data) {
      if (m.alumni_id) linked++;
      else unlinked++;
    }
    return { linked, unlinked };
  }, [data]);

  const filteredData = useMemo(() => {
    return data.filter((m) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        q === "" ||
        m.nama.toLowerCase().includes(q) ||
        (m.no_hp && m.no_hp.includes(searchQuery)) ||
        (m.pic && m.pic.toLowerCase().includes(q));

      const matchesAngkatan =
        filterAngkatan === "all" || m.angkatan === Number(filterAngkatan);

      const statusKey = filterField as keyof Member;
      const matchesStatus =
        filterStatus === "all" ||
        (filterStatus === "empty" && (m[statusKey] === null || m[statusKey] === "")) ||
        m[statusKey] === filterStatus;

      const matchesDuplicate =
        !filterDuplicates || (m.no_hp && duplicatePhones.has(m.no_hp.trim()));

      const matchesAlumniLink =
        filterAlumniLink === "all" ||
        (filterAlumniLink === "linked" && !!m.alumni_id) ||
        (filterAlumniLink === "unlinked" && !m.alumni_id);

      return matchesSearch && matchesAngkatan && matchesStatus && matchesDuplicate && matchesAlumniLink;
    });
  }, [data, searchQuery, filterAngkatan, filterStatus, filterField, filterDuplicates, duplicatePhones, filterAlumniLink]);

  const handleCreateMember = async (memberData: Partial<Member>) => {
    try {
      const res = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(memberData),
      });

      const result = await res.json();

      if (!res.ok) {
        showToast(result.error || "Gagal menambah anggota", "error");
        return;
      }

      showToast("Anggota berhasil ditambahkan", "success");
      setShowForm(false);
      await fetchMembers();
    } catch {
      showToast("Terjadi kesalahan jaringan", "error");
    }
  };

  const updateMember = useCallback(async (id: string, field: string, value: StatusValue) => {
    // Optimistic update
    setData((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [field]: value } : m))
    );

    const { error } = await supabase
      .from("members")
      .update({ [field]: value })
      .eq("id", id);

    if (error) {
      fetchMembers();
      showToast("Gagal mengupdate status", "error");
    }
  }, [fetchMembers, showToast]);

  const handleAlumniLink = useCallback(async (memberId: string, alumniId: string | null) => {
    try {
      const res = await fetch(`/api/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alumni_id: alumniId }),
      });
      if (res.ok) {
        // Optimistic update
        setData((prev) =>
          prev.map((m) => (m.id === memberId ? { ...m, alumni_id: alumniId } : m))
        );
        showToast(
          alumniId ? "Berhasil dihubungkan dengan alumni" : "Hubungan alumni diputuskan",
          "success"
        );
      } else {
        const result = await res.json();
        showToast(result.error || "Gagal mengubah link alumni", "error");
      }
    } catch {
      showToast("Terjadi kesalahan jaringan", "error");
    }
  }, [showToast]);

  const exportCSV = () => {
    const headers = ["No", "Nama", "Angkatan", "No HP", "PIC", "Status DPT", "Sudah Dikontak", "Masuk Grup", "Vote"];
    const rows = filteredData.map((m) => [
      m.no, m.nama, m.angkatan, m.no_hp, m.pic || "", m.status_dpt || "", m.sudah_dikontak || "", m.masuk_grup || "", m.vote || "",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "data_anggota.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#0B27BC]" />
          <p className="text-sm text-muted-foreground">Memuat data anggota...</p>
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
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-white">Data Anggota</h1>
              <p className="text-xs text-white/70">
                {formatNum(data.length)} anggota terdaftar
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={exportCSV}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-[#0B27BC] bg-white rounded-lg hover:bg-gray-100 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Export CSV</span>
              </button>
              {canManageUsers && (
                <button
                  onClick={() => setShowForm(!showForm)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-[#0B27BC] bg-white rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Tambah Anggota</span>
                  <span className="sm:hidden">Tambah</span>
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="h-1 bg-gradient-to-r from-[#fcb7c3] via-[#FE8DA1] to-[#fcb7c3]" />
      </header>

      <div className="px-4 sm:px-6 py-6 space-y-4">
        {/* Create Form */}
        {showForm && (
          <MemberForm
            allMembers={data}
            onSave={handleCreateMember}
            onCancel={() => setShowForm(false)}
          />
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl border border-border p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-[#0B27BC]" />
            <h3 className="font-semibold text-sm text-foreground">Filter & Pencarian</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama, no HP, PIC..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC]"
              />
            </div>
            <select
              value={filterAngkatan}
              onChange={(e) => setFilterAngkatan(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC] bg-white"
            >
              <option value="all">Semua Angkatan</option>
              {angkatanList.map((a) => (
                <option key={a} value={a}>
                  TN {a}
                </option>
              ))}
            </select>
            <select
              value={filterField}
              onChange={(e) => { setFilterField(e.target.value); setFilterStatus("all"); }}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC] bg-white"
            >
              <option value="status_dpt">Status DPT</option>
              <option value="sudah_dikontak">Sudah Dikontak</option>
              <option value="masuk_grup">Masuk Grup</option>
              <option value="vote">Vote</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC] bg-white"
            >
              <option value="all">Semua Status</option>
              <option value="Sudah">Sudah</option>
              <option value="Belum">Belum</option>
              <option value="empty">Belum diisi</option>
            </select>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {/* Alumni link filter */}
            <button
              onClick={() => setFilterAlumniLink(filterAlumniLink === "linked" ? "all" : "linked")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                filterAlumniLink === "linked"
                  ? "bg-emerald-500 text-white"
                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              Terhubung Alumni ({formatNum(alumniLinkCounts.linked)})
            </button>
            <button
              onClick={() => setFilterAlumniLink(filterAlumniLink === "unlinked" ? "all" : "unlinked")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                filterAlumniLink === "unlinked"
                  ? "bg-gray-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200"
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              Belum Terhubung ({formatNum(alumniLinkCounts.unlinked)})
            </button>
            {/* Duplicate filter */}
            {duplicateMemberCount > 0 && (
              <button
                onClick={() => setFilterDuplicates(!filterDuplicates)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  filterDuplicates
                    ? "bg-[#FE8DA1] text-white"
                    : "bg-[#FE8DA1]/10 text-[#84303F] hover:bg-[#FE8DA1]/20 border border-[#FE8DA1]/30"
                }`}
              >
                <Copy className="w-3.5 h-3.5" />
                Duplikat No. HP ({formatNum(duplicateMemberCount)})
              </button>
            )}
          </div>
        </div>

        {/* Data Table with inline editing + row click to detail */}
        <DataTable
          data={filteredData}
          allData={data}
          attendanceCounts={attendanceCounts}
          onUpdate={userCanEdit ? updateMember : undefined}
          onAlumniLink={userCanEdit ? handleAlumniLink : undefined}
          onRowClick={(id) => router.push(`/anggota/${id}`)}
          totalCount={data.length}
          onDataRefresh={fetchMembers}
        />
      </div>
    </div>
  );
}
