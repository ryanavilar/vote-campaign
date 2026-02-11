"use client";

import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { StatsCards } from "@/components/StatsCards";
import { AngkatanChart } from "@/components/AngkatanChart";
import { ProgressChart } from "@/components/ProgressChart";
import { Download, Loader2 } from "lucide-react";
import type { Member } from "@/lib/types";

export default function Dashboard() {
  const [data, setData] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMembers();
  }, []);

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

  const exportCSV = () => {
    const headers = ["No", "Nama", "Angkatan", "No HP", "PIC", "Status DPT", "Sudah Dikontak", "Masuk Grup", "Vote"];
    const rows = data.map((m) => [
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
    <div className="bg-background">
      {/* Page Header */}
      <header className="sticky top-0 z-40 bg-[#0B27BC] text-white shadow-lg">
        <div className="px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-white">
                Dashboard Pemenangan
              </h1>
              <p className="text-xs text-white/70">
                Ikastara Kita &mdash; Aditya Syarief
              </p>
            </div>
            <button
              onClick={exportCSV}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-[#0B27BC] bg-white rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
          </div>
        </div>
        <div className="h-1 bg-gradient-to-r from-[#fcb7c3] via-[#FE8DA1] to-[#fcb7c3]" />
      </header>

      <div className="px-4 sm:px-6 py-6 space-y-6">
        {/* Stats Cards */}
        <StatsCards stats={stats} />

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ProgressChart stats={stats} />
          <AngkatanChart data={angkatanStats} />
        </div>
      </div>
    </div>
  );
}
