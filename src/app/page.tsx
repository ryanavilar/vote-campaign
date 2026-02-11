"use client";

import { useState, useMemo } from "react";
import { members, angkatanList, type Member, type StatusValue } from "@/lib/data";
import { StatsCards } from "@/components/StatsCards";
import { AngkatanChart } from "@/components/AngkatanChart";
import { ProgressChart } from "@/components/ProgressChart";
import { DataTable } from "@/components/DataTable";
import { Search, Filter, Download } from "lucide-react";

export default function Dashboard() {
  const [data, setData] = useState<Member[]>(members);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAngkatan, setFilterAngkatan] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterField, setFilterField] = useState<string>("statusDpt");

  const filteredData = useMemo(() => {
    return data.filter((m) => {
      const matchesSearch =
        searchQuery === "" ||
        m.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.noHp.includes(searchQuery) ||
        m.pic.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesAngkatan =
        filterAngkatan === "all" || m.angkatan === Number(filterAngkatan);

      const statusKey = filterField as keyof Member;
      const matchesStatus =
        filterStatus === "all" ||
        (filterStatus === "empty" && m[statusKey] === "") ||
        m[statusKey] === filterStatus;

      return matchesSearch && matchesAngkatan && matchesStatus;
    });
  }, [data, searchQuery, filterAngkatan, filterStatus, filterField]);

  const stats = useMemo(() => {
    const total = data.length;
    const dptSudah = data.filter((m) => m.statusDpt === "Sudah").length;
    const kontakSudah = data.filter((m) => m.sudahDikontak === "Sudah").length;
    const grupSudah = data.filter((m) => m.masukGrup === "Sudah").length;
    const voteSudah = data.filter((m) => m.vote === "Sudah").length;

    return { total, dptSudah, kontakSudah, grupSudah, voteSudah };
  }, [data]);

  const angkatanStats = useMemo(() => {
    const map = new Map<number, { total: number; dpt: number; kontak: number; grup: number; vote: number }>();
    data.forEach((m) => {
      const existing = map.get(m.angkatan) || { total: 0, dpt: 0, kontak: 0, grup: 0, vote: 0 };
      existing.total++;
      if (m.statusDpt === "Sudah") existing.dpt++;
      if (m.sudahDikontak === "Sudah") existing.kontak++;
      if (m.masukGrup === "Sudah") existing.grup++;
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

  const updateMember = (no: number, field: keyof Member, value: StatusValue) => {
    setData((prev) =>
      prev.map((m) => (m.no === no ? { ...m, [field]: value } : m))
    );
  };

  const exportCSV = () => {
    const headers = ["No", "Nama", "Angkatan", "No HP", "PIC", "Status DPT", "Sudah Dikontak", "Masuk Grup", "Vote"];
    const rows = filteredData.map((m) => [
      m.no, m.nama, m.angkatan, m.noHp, m.pic, m.statusDpt, m.sudahDikontak, m.masukGrup, m.vote,
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-border shadow-sm">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">
                Dashboard Pemenangan
              </h1>
              <p className="text-sm text-muted-foreground">
                Ikastara Kita &mdash; Aditya Syarief
              </p>
            </div>
            <button
              onClick={exportCSV}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors self-start sm:self-auto"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>
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
            <Filter className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm text-foreground">Filter & Pencarian</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Cari nama, no HP, PIC..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>

            {/* Filter Angkatan */}
            <select
              value={filterAngkatan}
              onChange={(e) => setFilterAngkatan(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
            >
              <option value="all">Semua Angkatan</option>
              {angkatanList.map((a) => (
                <option key={a} value={a}>
                  TN {a}
                </option>
              ))}
            </select>

            {/* Filter Field */}
            <select
              value={filterField}
              onChange={(e) => {
                setFilterField(e.target.value);
                setFilterStatus("all");
              }}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
            >
              <option value="statusDpt">Status DPT</option>
              <option value="sudahDikontak">Sudah Dikontak</option>
              <option value="masukGrup">Masuk Grup</option>
              <option value="vote">Vote</option>
            </select>

            {/* Filter Status */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
            >
              <option value="all">Semua Status</option>
              <option value="Sudah">Sudah</option>
              <option value="Belum">Belum</option>
              <option value="empty">Belum diisi</option>
            </select>
          </div>
        </div>

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
