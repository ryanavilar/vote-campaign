"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { StatsCards } from "@/components/StatsCards";
import { AngkatanChart } from "@/components/AngkatanChart";
import { ProgressChart } from "@/components/ProgressChart";
import { DataTable } from "@/components/DataTable";
import { Search, Filter, Download, LogOut, Loader2 } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";

export type StatusValue = "Sudah" | "Belum" | null;

export interface Member {
  id: string;
  no: number;
  nama: string;
  angkatan: number;
  no_hp: string;
  pic: string | null;
  status_dpt: StatusValue;
  sudah_dikontak: StatusValue;
  masuk_grup: StatusValue;
  vote: StatusValue;
}

export default function Dashboard() {
  const [data, setData] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAngkatan, setFilterAngkatan] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterField, setFilterField] = useState<string>("status_dpt");
  const [userEmail, setUserEmail] = useState<string>("");
  const router = useRouter();

  useEffect(() => {
    fetchMembers();
    fetchUser();
  }, []);

  const fetchUser = async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      setUserEmail(data.user.email || "");
    }
  };

  const fetchMembers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("members")
      .select("*")
      .order("no", { ascending: true });

    if (!error && data) {
      setData(data);
    }
    setLoading(false);
  };

  const angkatanList = useMemo(() => {
    return Array.from(new Set(data.map((m) => m.angkatan))).sort((a, b) => a - b);
  }, [data]);

  const filteredData = useMemo(() => {
    return data.filter((m) => {
      const matchesSearch =
        searchQuery === "" ||
        m.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.no_hp && m.no_hp.includes(searchQuery)) ||
        (m.pic && m.pic.toLowerCase().includes(searchQuery.toLowerCase()));

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

  const stats = useMemo(() => {
    const total = data.length;
    const dptSudah = data.filter((m) => m.status_dpt === "Sudah").length;
    const kontakSudah = data.filter((m) => m.sudah_dikontak === "Sudah").length;
    const grupSudah = data.filter((m) => m.masuk_grup === "Sudah").length;
    const voteSudah = data.filter((m) => m.vote === "Sudah").length;
    return { total, dptSudah, kontakSudah, grupSudah, voteSudah };
  }, [data]);

  const angkatanStats = useMemo(() => {
    const map = new Map<number, { total: number; dpt: number; kontak: number; grup: number; vote: number }>();
    data.forEach((m) => {
      const existing = map.get(m.angkatan) || { total: 0, dpt: 0, kontak: 0, grup: 0, vote: 0 };
      existing.total++;
      if (m.status_dpt === "Sudah") existing.dpt++;
      if (m.sudah_dikontak === "Sudah") existing.kontak++;
      if (m.masuk_grup === "Sudah") existing.grup++;
      if (m.vote === "Sudah") existing.vote++;
      map.set(m.angkatan, existing);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([angkatan, s]) => ({
        angkatan: `TN${angkatan}`,
        angkatanNum: angkatan,
        ...s,
      }));
  }, [data]);

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
      // Revert on error
      fetchMembers();
    }
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

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
    a.download = "dashboard_pemenangan.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#0B27BC]" />
          <p className="text-sm text-muted-foreground">Memuat data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header with brand */}
      <header className="sticky top-0 z-50 bg-[#0B27BC] text-white shadow-lg">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Image
                src="/images/logo-light.png"
                alt="IKASTARA KITA"
                width={120}
                height={40}
                className="rounded"
              />
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-white">
                  Dashboard Pemenangan
                </h1>
                <p className="text-xs text-white/70">
                  Ikastara Kita &mdash; Aditya Syarief &bull; Asah &bull; Asih &bull; Asuh
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={exportCSV}
                className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-[#0B27BC] bg-white rounded-lg hover:bg-gray-100 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </button>
              <div className="flex items-center gap-2">
                <span className="hidden sm:block text-xs text-white/70">{userEmail}</span>
                <button
                  onClick={handleLogout}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4 text-white/80" />
                </button>
              </div>
            </div>
          </div>
        </div>
        {/* Pink accent bar */}
        <div className="h-1 bg-gradient-to-r from-[#fcb7c3] via-[#FE8DA1] to-[#fcb7c3]" />
      </header>

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Stats Cards */}
        <StatsCards stats={stats} />

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ProgressChart stats={stats} />
          <AngkatanChart data={angkatanStats} />
        </div>

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
                placeholder="Cari nama, no HP, PIC..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
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
                <option key={a} value={a}>TN {a}</option>
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

        {/* Mobile export button */}
        <button
          onClick={exportCSV}
          className="sm:hidden w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#0B27BC] rounded-lg"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>

        {/* Data Table */}
        <DataTable
          data={filteredData}
          onUpdate={updateMember}
          totalCount={data.length}
        />
      </main>
    </div>
  );
}
