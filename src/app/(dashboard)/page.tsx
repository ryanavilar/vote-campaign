"use client";

import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { StatsCards } from "@/components/StatsCards";
import { AngkatanChart } from "@/components/AngkatanChart";
import { ProgressChart } from "@/components/ProgressChart";
import { Download, Loader2, Link2, Copy, Check, ExternalLink } from "lucide-react";
import { useRole } from "@/lib/RoleContext";
import type { Member } from "@/lib/types";
import * as XLSX from "xlsx";

interface AlumniStats {
  totalAlumni: number;
  linkedAlumni: number;
  alumniByAngkatan: Record<string, number>;
}

interface WaGroupStats {
  totalInGroup: number;
  linked: number;
  unlinked: number;
  memberInGroup: Record<string, boolean>;
}

function FormLinkRow({
  label,
  description,
  path,
  copied,
  onCopy,
}: {
  label: string;
  description: string;
  path: string;
  copied: string | null;
  onCopy: (url: string) => void;
}) {
  const fullUrl = typeof window !== "undefined" ? `${window.location.origin}${path}` : path;
  const isCopied = copied === fullUrl;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 rounded-lg bg-gray-50 border border-border">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
        <p className="text-xs font-mono text-[#0B27BC] mt-1 truncate">{fullUrl}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => onCopy(fullUrl)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            isCopied
              ? "bg-emerald-100 text-emerald-700"
              : "bg-[#0B27BC] text-white hover:bg-[#091fa0]"
          }`}
        >
          {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {isCopied ? "Tersalin!" : "Salin Link"}
        </button>
        <a
          href={path}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-border rounded-lg hover:bg-gray-50 transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          Buka
        </a>
      </div>
    </div>
  );
}

/* Skeleton placeholder for a single stats card */
function CardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-border p-4 shadow-sm animate-pulse">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-lg bg-gray-200" />
      </div>
      <div className="h-7 w-16 bg-gray-200 rounded mb-1" />
      <div className="h-3 w-24 bg-gray-100 rounded" />
    </div>
  );
}

/* Skeleton placeholder for a chart card */
function ChartSkeleton({ title }: { title: string }) {
  return (
    <div className="bg-white rounded-xl border border-border p-4 shadow-sm">
      <h3 className="font-semibold text-foreground mb-4">{title}</h3>
      <div className="flex items-center justify-center h-[200px]">
        <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<Member[]>([]);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [alumniStats, setAlumniStats] = useState<AlumniStats>({
    totalAlumni: 0,
    linkedAlumni: 0,
    alumniByAngkatan: {},
  });
  const [alumniLoaded, setAlumniLoaded] = useState(false);
  const [waGroupStats, setWaGroupStats] = useState<WaGroupStats>({
    totalInGroup: 0,
    linked: 0,
    unlinked: 0,
    memberInGroup: {},
  });
  const [waGroupLoaded, setWaGroupLoaded] = useState(false);
  const { loading: roleLoading } = useRole();

  useEffect(() => {
    if (roleLoading) return;
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleLoading]);

  const fetchData = async () => {
    // Fetch all members for dashboard
    const membersPromise = (async (): Promise<Member[]> => {
      const { data, error } = await supabase
        .from("members")
        .select("*")
        .order("no", { ascending: true });
      return !error && data ? data : [];
    })();

    // Fetch alumni stats
    const alumniPromise = fetch("/api/alumni/stats")
      .then((res) => res.json())
      .catch(() => ({ totalAlumni: 0, linkedAlumni: 0, alumniByAngkatan: {} }));

    // Fetch WA Group stats
    const waGroupPromise = fetch("/api/wa-group/stats")
      .then((res) => res.json())
      .catch(() => ({ totalInGroup: 0, linked: 0, unlinked: 0, memberInGroup: {} }));

    // Progressive loading — render as each piece arrives
    membersPromise.then((members) => {
      setData(members);
      setMembersLoaded(true);
    });

    alumniPromise.then((aStats) => {
      setAlumniStats(aStats);
      setAlumniLoaded(true);
    });

    waGroupPromise.then((wStats) => {
      setWaGroupStats(wStats);
      setWaGroupLoaded(true);
    });
  };

  const stats = useMemo(() => {
    const total = data.length;
    const dptSudah = data.filter((m) => m.status_dpt === "Sudah").length;
    // Masuk Grup is now automatic from WA Group data
    const grupSudah = data.filter((m) => waGroupStats.memberInGroup[m.id]).length;
    const voteSudah = data.filter((m) => m.vote === "Sudah").length;
    return {
      total,
      totalAlumni: alumniStats.totalAlumni,
      linkedAlumni: alumniStats.linkedAlumni,
      dptSudah,
      grupSudah,
      grupLinked: waGroupStats.linked,
      grupUnlinked: waGroupStats.unlinked,
      totalInGroup: waGroupStats.totalInGroup,
      voteSudah,
    };
  }, [data, alumniStats, waGroupStats]);

  const angkatanStats = useMemo(() => {
    const map = new Map<number, { total: number; dpt: number; kontak: number; grup: number; vote: number; alumni: number }>();
    data.forEach((m) => {
      const existing = map.get(m.angkatan) || { total: 0, dpt: 0, kontak: 0, grup: 0, vote: 0, alumni: 0 };
      existing.total++;
      if (m.status_dpt === "Sudah") existing.dpt++;
      if (m.sudah_dikontak === "Sudah") existing.kontak++;
      if (waGroupStats.memberInGroup[m.id]) existing.grup++;
      if (m.vote === "Sudah") existing.vote++;
      map.set(m.angkatan, existing);
    });

    // Merge alumni data
    for (const [angkatan, count] of Object.entries(alumniStats.alumniByAngkatan)) {
      const num = Number(angkatan);
      const existing = map.get(num) || { total: 0, dpt: 0, kontak: 0, grup: 0, vote: 0, alumni: 0 };
      existing.alumni = count;
      map.set(num, existing);
    }

    return Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([angkatan, s]) => ({
        angkatan: `TN${angkatan}`,
        angkatanNum: angkatan,
        ...s,
      }));
  }, [data, alumniStats.alumniByAngkatan, waGroupStats.memberInGroup]);

  const exportExcel = () => {
    const rows = data.map((m) => ({
      No: m.no,
      Nama: m.nama,
      Angkatan: m.angkatan,
      "No HP": m.no_hp || "",
      PIC: m.pic || "",
      "Masuk Grup WA": waGroupStats.memberInGroup[m.id] ? "Sudah" : "Belum",
      "Status DPT": m.status_dpt || "",
      Vote: m.vote || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dashboard Pemenangan");
    XLSX.writeFile(wb, "dashboard_pemenangan.xlsx");
  };

  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedLink(url);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  // Show nothing until role loads
  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#0B27BC]" />
          <p className="text-sm text-muted-foreground">Memuat data...</p>
        </div>
      </div>
    );
  }

  const bothLoaded = membersLoaded && alumniLoaded && waGroupLoaded;

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
              onClick={exportExcel}
              disabled={!membersLoaded}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-[#0B27BC] bg-white rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export Excel</span>
            </button>
          </div>
        </div>
        <div className="h-1 bg-gradient-to-r from-[#fcb7c3] via-[#FE8DA1] to-[#fcb7c3]" />
      </header>

      <div className="px-4 sm:px-6 py-6 space-y-6">
        {/* Stats Cards — show skeleton until data arrives */}
        {membersLoaded ? (
          <StatsCards stats={stats} alumniLoaded={alumniLoaded} />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Public Form Links */}
        <div className="bg-white rounded-xl border border-border shadow-sm p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <Link2 className="w-4 h-4 text-[#0B27BC]" />
            <h3 className="font-semibold text-sm text-foreground">Link Formulir Publik</h3>
          </div>
          <div className="space-y-3">
            <FormLinkRow
              label="Form Dukungan"
              description="Formulir pendaftaran dukungan untuk Aditya Syarief"
              path="/form/dukungan"
              copied={copiedLink}
              onCopy={copyToClipboard}
            />
          </div>
        </div>

        {/* Charts Row — show skeleton until both data sources loaded */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {bothLoaded ? (
            <>
              <ProgressChart stats={stats} />
              <AngkatanChart data={angkatanStats} />
            </>
          ) : membersLoaded ? (
            <>
              <ProgressChart stats={stats} />
              <ChartSkeleton title="Data per Angkatan" />
            </>
          ) : (
            <>
              <ChartSkeleton title="Progress Keseluruhan" />
              <ChartSkeleton title="Data per Angkatan" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
