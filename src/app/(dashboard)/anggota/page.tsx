"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useRole } from "@/lib/RoleContext";
import { useToast } from "@/components/Toast";
import { MemberForm } from "@/components/MemberForm";
import { EmptyState } from "@/components/EmptyState";
import {
  Search,
  Plus,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Users,
  Filter,
} from "lucide-react";
import type { Member, StatusValue } from "@/lib/types";

const PAGE_SIZE = 25;

function StatusBadge({ value }: { value: StatusValue }) {
  const colors = {
    Sudah: "bg-emerald-100 text-emerald-700 border-emerald-200",
    Belum: "bg-red-100 text-red-700 border-red-200",
  };
  const colorClass = value ? colors[value] : "bg-gray-50 text-gray-400 border-gray-200";

  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-md border inline-block ${colorClass}`}>
      {value || "-"}
    </span>
  );
}

export default function AnggotaPage() {
  const [data, setData] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAngkatan, setFilterAngkatan] = useState<string>("all");
  const [page, setPage] = useState(0);
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

      return matchesSearch && matchesAngkatan;
    });
  }, [data, searchQuery, filterAngkatan]);

  const totalPages = Math.ceil(filteredData.length / PAGE_SIZE);
  const pageData = filteredData.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [searchQuery, filterAngkatan]);

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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#0B27BC]" />
              <h3 className="font-semibold text-foreground text-sm">
                Daftar Anggota{" "}
                <span className="font-normal text-muted-foreground">
                  ({filteredData.length} dari {data.length})
                </span>
              </h3>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-muted-foreground">
                {page + 1} / {Math.max(1, totalPages)}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                disabled={page >= totalPages - 1}
                className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#0B27BC]/5">
                  <th className="px-3 py-2.5 text-left font-semibold text-xs text-[#0B27BC]/70 uppercase tracking-wider w-10">
                    No
                  </th>
                  <th className="px-3 py-2.5 text-left font-semibold text-xs text-[#0B27BC]/70 uppercase tracking-wider min-w-[160px]">
                    Nama
                  </th>
                  <th className="px-3 py-2.5 text-center font-semibold text-xs text-[#0B27BC]/70 uppercase tracking-wider w-16">
                    TN
                  </th>
                  <th className="px-3 py-2.5 text-left font-semibold text-xs text-[#0B27BC]/70 uppercase tracking-wider w-[130px]">
                    No. HP
                  </th>
                  <th className="px-3 py-2.5 text-left font-semibold text-xs text-[#0B27BC]/70 uppercase tracking-wider w-[100px]">
                    PIC
                  </th>
                  <th className="px-3 py-2.5 text-center font-semibold text-xs text-[#0B27BC]/70 uppercase tracking-wider w-[80px]">
                    DPT
                  </th>
                  <th className="px-3 py-2.5 text-center font-semibold text-xs text-[#0B27BC]/70 uppercase tracking-wider w-[80px]">
                    Kontak
                  </th>
                  <th className="px-3 py-2.5 text-center font-semibold text-xs text-[#0B27BC]/70 uppercase tracking-wider w-[80px]">
                    Grup
                  </th>
                  <th className="px-3 py-2.5 text-center font-semibold text-xs text-[#0B27BC]/70 uppercase tracking-wider w-[80px]">
                    Vote
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pageData.map((member) => (
                  <tr
                    key={member.id}
                    onClick={() => router.push(`/anggota/${member.id}`)}
                    className="hover:bg-[#0B27BC]/[0.02] transition-colors cursor-pointer"
                  >
                    <td className="px-3 py-2 text-muted-foreground">{member.no}</td>
                    <td className="px-3 py-2 font-medium text-foreground">
                      {member.nama}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-[#0B27BC]/10 text-[#0B27BC] text-xs font-medium">
                        TN{member.angkatan}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground font-mono text-xs">
                      {member.no_hp}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground text-xs truncate max-w-[100px]">
                      {member.pic || "-"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <StatusBadge value={member.status_dpt} />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <StatusBadge value={member.sudah_dikontak} />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <StatusBadge value={member.masuk_grup} />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <StatusBadge value={member.vote} />
                    </td>
                  </tr>
                ))}
                {pageData.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-3 py-2">
                      <EmptyState
                        icon={Search}
                        title="Tidak ada anggota ditemukan"
                        description="Coba ubah kata kunci pencarian atau filter angkatan"
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
