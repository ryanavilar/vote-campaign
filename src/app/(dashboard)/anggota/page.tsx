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
} from "lucide-react";
import type { Member, StatusValue } from "@/lib/types";

export default function AnggotaPage() {
  const [data, setData] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAngkatan, setFilterAngkatan] = useState<string>("all");
  const [filterField, setFilterField] = useState<string>("status_dpt");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const { canEdit: userCanEdit } = useRole();
  const { showToast } = useToast();
  const router = useRouter();

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    const { data: members, error } = await supabase
      .from("members")
      .select("*")
      .order("no", { ascending: true });

    if (!error && members) {
      setData(members);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const angkatanList = useMemo(() => {
    return Array.from(new Set(data.map((m) => m.angkatan))).sort((a, b) => a - b);
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

      return matchesSearch && matchesAngkatan && matchesStatus;
    });
  }, [data, searchQuery, filterAngkatan, filterStatus, filterField]);

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
                {data.length} anggota terdaftar
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
              {userCanEdit && (
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
        </div>

        {/* Data Table with inline editing + row click to detail */}
        <DataTable
          data={filteredData}
          onUpdate={userCanEdit ? updateMember : undefined}
          onRowClick={(id) => router.push(`/anggota/${id}`)}
          totalCount={data.length}
        />
      </div>
    </div>
  );
}
