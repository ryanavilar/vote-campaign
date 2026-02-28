"use client";

import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Download,
  Loader2,
  Link2,
  Copy,
  Check,
  ExternalLink,
  Crosshair,
  ThumbsUp,
  HelpCircle,
  ArrowLeftRight,
  MessageCircle,
  Smartphone,
  ClipboardCheck,
  Vote,
  GraduationCap,
  Users,
  RefreshCw,
} from "lucide-react";
import { useRole } from "@/lib/RoleContext";
import type { Member } from "@/lib/types";
import { formatNum } from "@/lib/format";
import * as XLSX from "xlsx";

/* ── Types ─────────────────────────────────────── */

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

/* ── Battle Bar (stacked horizontal) ───────────── */

function BattleBar({
  segments,
}: {
  segments: { value: number; color: string; label: string }[];
}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return <div className="w-full h-8 rounded-xl bg-gray-100" />;

  return (
    <div className="w-full h-8 sm:h-10 rounded-xl overflow-hidden flex bg-gray-100">
      {segments.map((seg, i) => {
        const pct = (seg.value / total) * 100;
        if (pct === 0) return null;
        return (
          <div
            key={i}
            className={`${seg.color} flex items-center justify-center transition-all duration-700`}
            style={{ width: `${pct}%` }}
            title={`${seg.label}: ${formatNum(seg.value)} (${Math.round(pct)}%)`}
          >
            {pct > 8 && (
              <span className="text-[10px] sm:text-xs font-bold text-white truncate px-1">
                {Math.round(pct)}%
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Form Link Row ─────────────────────────────── */

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
  const fullUrl =
    typeof window !== "undefined" ? `${window.location.origin}${path}` : path;
  const isCopied = copied === fullUrl;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 rounded-lg bg-gray-50 border border-border">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
        <p className="text-xs font-mono text-[#0B27BC] mt-1 truncate">
          {fullUrl}
        </p>
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
          {isCopied ? (
            <Check className="w-3 h-3" />
          ) : (
            <Copy className="w-3 h-3" />
          )}
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

/* ── Skeletons ─────────────────────────────────── */

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

/* ── Angkatan Chart Tooltip ────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function AngkatanTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const total = payload.reduce((s: number, p: any) => s + (p.value || 0), 0);
  return (
    <div className="bg-white px-3 py-2 rounded-lg border border-border shadow-md text-xs">
      <p className="font-semibold text-foreground mb-1">
        {label} &middot; {formatNum(total)} terdata
      </p>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((p: any) =>
        p.value > 0 ? (
          <div key={p.name} className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: p.color }}
            />
            <span className="text-muted-foreground">{p.name}:</span>
            <span className="font-medium text-foreground">
              {formatNum(p.value)}
            </span>
          </div>
        ) : null
      )}
    </div>
  );
}

/* ── Main Dashboard ────────────────────────────── */

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
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  useEffect(() => {
    if (roleLoading) return;
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleLoading]);

  const fetchData = async () => {
    // Fetch all members
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
      .catch(() => ({
        totalInGroup: 0,
        linked: 0,
        unlinked: 0,
        memberInGroup: {},
      }));

    // Progressive loading
    membersPromise.then((members) => {
      setData(members);
      setMembersLoaded(true);
    });
    alumniPromise.then((aStats: AlumniStats) => {
      setAlumniStats(aStats);
      setAlumniLoaded(true);
    });
    waGroupPromise.then((wStats: WaGroupStats) => {
      setWaGroupStats(wStats);
      setWaGroupLoaded(true);
    });
  };

  /* ── Battlefield Stats ── */
  const battlefield = useMemo(() => {
    const pendukung = data.filter(
      (m) => m.dukungan === "dukung" || m.dukungan === "terkonvert"
    ).length;
    const ragu = data.filter((m) => m.dukungan === "ragu_ragu").length;
    const lawan = data.filter((m) => m.dukungan === "milih_sebelah").length;
    const contacted = data.filter(
      (m) => m.sudah_dikontak === "Sudah"
    ).length;
    const known = pendukung + ragu + lawan;
    const belumTahu = Math.max(0, contacted - known);
    const base = contacted || 1;

    return {
      pendukung,
      ragu,
      lawan,
      belumTahu,
      contacted,
      total: data.length,
      pendukungPct: Math.round((pendukung / base) * 100),
      raguPct: Math.round((ragu / base) * 100),
      lawanPct: Math.round((lawan / base) * 100),
    };
  }, [data]);

  /* ── Operational Stats ── */
  const opStats = useMemo(() => {
    const grupSudah = data.filter(
      (m) => waGroupStats.memberInGroup[m.id]
    ).length;
    const dptSudah = data.filter((m) => m.status_dpt === "Sudah").length;
    const voteSudah = data.filter((m) => m.vote === "Sudah").length;
    const contacted = data.filter(
      (m) => m.sudah_dikontak === "Sudah"
    ).length;

    return {
      totalAlumni: alumniStats.totalAlumni,
      linkedAlumni: alumniStats.linkedAlumni,
      totalMembers: data.length,
      contacted,
      grupSudah,
      grupLinked: waGroupStats.linked,
      dptSudah,
      voteSudah,
    };
  }, [data, alumniStats, waGroupStats]);

  /* ── Per-Angkatan Battle Data ── */
  const angkatanBattle = useMemo(() => {
    const map = new Map<
      number,
      { pendukung: number; ragu: number; lawan: number; belumTahu: number; alumni: number }
    >();

    data.forEach((m) => {
      const ex = map.get(m.angkatan) || {
        pendukung: 0, ragu: 0, lawan: 0, belumTahu: 0, alumni: 0,
      };
      if (m.dukungan === "dukung" || m.dukungan === "terkonvert") ex.pendukung++;
      else if (m.dukungan === "ragu_ragu") ex.ragu++;
      else if (m.dukungan === "milih_sebelah") ex.lawan++;
      else ex.belumTahu++;
      map.set(m.angkatan, ex);
    });

    for (const [angkatan, count] of Object.entries(alumniStats.alumniByAngkatan)) {
      const num = Number(angkatan);
      const ex = map.get(num) || {
        pendukung: 0, ragu: 0, lawan: 0, belumTahu: 0, alumni: 0,
      };
      ex.alumni = count;
      map.set(num, ex);
    }

    return Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([angkatan, s]) => ({ angkatan: `TN${angkatan}`, ...s }));
  }, [data, alumniStats.alumniByAngkatan]);

  /* ── Excel Export ── */
  const exportExcel = () => {
    const rows = data.map((m) => ({
      No: m.no,
      Nama: m.nama,
      Angkatan: m.angkatan,
      "No HP": m.no_hp || "",
      "No HP Tambahan": (m.alt_phones || []).join(", "),
      PIC: m.pic || "",
      "Sudah Dikontak": m.sudah_dikontak || "",
      Dukungan: m.dukungan || "",
      "Masuk Grup WA": waGroupStats.memberInGroup[m.id] ? "Sudah" : "Belum",
      "Status DPT": m.status_dpt || "",
      Vote: m.vote || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dashboard Pemenangan");
    XLSX.writeFile(wb, "dashboard_pemenangan.xlsx");
  };

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedLink(url);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  /* ── Loading ── */
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

  /* ── Battle cards config ── */
  const battleCards = [
    {
      label: "Pendukung",
      value: battlefield.pendukung,
      pct: battlefield.pendukungPct,
      icon: ThumbsUp,
      color: "text-emerald-700",
      bg: "bg-emerald-50",
      border: "border-emerald-200",
    },
    {
      label: "Ragu-Ragu",
      value: battlefield.ragu,
      pct: battlefield.raguPct,
      icon: HelpCircle,
      color: "text-yellow-700",
      bg: "bg-yellow-50",
      border: "border-yellow-200",
    },
    {
      label: "Pihak Lain",
      value: battlefield.lawan,
      pct: battlefield.lawanPct,
      icon: ArrowLeftRight,
      color: "text-red-700",
      bg: "bg-red-50",
      border: "border-red-200",
    },
  ];

  /* ── Stats cards config ── */
  const statsCards = [
    {
      label: "Total Alumni",
      value: opStats.totalAlumni,
      icon: GraduationCap,
      color: "text-[#84303F]",
      bg: "bg-[#84303F]/10",
      sub: `${formatNum(opStats.linkedAlumni)} terhubung`,
      loading: !alumniLoaded,
    },
    {
      label: "Anggota Terdata",
      value: opStats.totalMembers,
      icon: Users,
      color: "text-[#0B27BC]",
      bg: "bg-[#0B27BC]/10",
    },
    {
      label: "Sudah Kontak",
      value: opStats.contacted,
      icon: MessageCircle,
      color: "text-[#0B27BC]",
      bg: "bg-[#0B27BC]/10",
      sub: `${opStats.totalMembers > 0 ? Math.round((opStats.contacted / opStats.totalMembers) * 100) : 0}%`,
    },
    {
      label: "Masuk Grup",
      value: opStats.grupSudah,
      icon: Smartphone,
      color: "text-[#0B27BC]",
      bg: "bg-[#0B27BC]/10",
      sub: `${formatNum(opStats.grupLinked)} linked`,
      loading: !waGroupLoaded,
    },
    {
      label: "DPT",
      value: opStats.dptSudah,
      icon: ClipboardCheck,
      color: "text-emerald-700",
      bg: "bg-emerald-50",
    },
    {
      label: "Vote",
      value: opStats.voteSudah,
      icon: Vote,
      color: "text-[#84303F]",
      bg: "bg-[#84303F]/10",
    },
  ];

  /* ── Progress donuts config ── */
  const progressData = [
    { label: "Kontak", value: opStats.contacted, total: opStats.totalMembers, color: "#0B27BC" },
    { label: "Grup WA", value: opStats.grupSudah, total: opStats.totalMembers, color: "#0B27BC" },
    { label: "DPT", value: opStats.dptSudah, total: opStats.totalMembers, color: "#10b981" },
    { label: "Vote", value: opStats.voteSudah, total: opStats.totalMembers, color: "#84303F" },
  ];

  return (
    <div className="bg-background min-h-screen">
      {/* Header */}
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
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setMembersLoaded(false);
                  setAlumniLoaded(false);
                  setWaGroupLoaded(false);
                  fetchData();
                }}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white/80 hover:text-white transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={exportExcel}
                disabled={!membersLoaded}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-[#0B27BC] bg-white rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Export</span>
              </button>
            </div>
          </div>
        </div>
        <div className="h-1 bg-gradient-to-r from-[#fcb7c3] via-[#FE8DA1] to-[#fcb7c3]" />
      </header>

      <div className="px-4 sm:px-6 py-6 space-y-4">
        {/* ═══════ PETA PERTARUNGAN ═══════ */}
        {membersLoaded ? (
          <div className="bg-white rounded-xl border border-border shadow-sm p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-4">
              <Crosshair className="w-5 h-5 text-[#0B27BC]" />
              <h2 className="text-base font-bold text-foreground">
                Peta Pertarungan
              </h2>
              <span className="text-[10px] sm:text-xs text-muted-foreground ml-auto">
                dari {formatNum(battlefield.contacted)} yang sudah dikontak
              </span>
            </div>

            {/* Battle Bar */}
            <BattleBar
              segments={[
                { value: battlefield.pendukung, color: "bg-emerald-500", label: "Pendukung" },
                { value: battlefield.ragu, color: "bg-yellow-400", label: "Ragu-Ragu" },
                { value: battlefield.lawan, color: "bg-red-500", label: "Pihak Lain" },
                { value: battlefield.belumTahu, color: "bg-gray-300", label: "Belum Tahu" },
              ]}
            />

            {/* Legend */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 mb-4">
              {[
                { label: "Pendukung", color: "bg-emerald-500" },
                { label: "Ragu-Ragu", color: "bg-yellow-400" },
                { label: "Pihak Lain", color: "bg-red-500" },
                { label: "Belum Tahu", color: "bg-gray-300" },
              ].map((l) => (
                <div key={l.label} className="flex items-center gap-1.5">
                  <div className={`w-2.5 h-2.5 rounded-full ${l.color}`} />
                  <span className="text-[10px] text-muted-foreground">{l.label}</span>
                </div>
              ))}
            </div>

            {/* Battle Cards — 3 main categories */}
            <div className="grid grid-cols-3 gap-3">
              {battleCards.map((card) => {
                const Icon = card.icon;
                return (
                  <div
                    key={card.label}
                    className={`rounded-xl border-2 ${card.border} ${card.bg} p-3 sm:p-4 text-center`}
                  >
                    <div className="flex justify-center mb-1">
                      <Icon className={`w-5 h-5 ${card.color}`} />
                    </div>
                    <p className={`text-2xl sm:text-3xl font-bold ${card.color} leading-tight`}>
                      {formatNum(card.value)}
                    </p>
                    <p className="text-xs font-medium text-muted-foreground mt-0.5">
                      {card.label}
                    </p>
                    <p className={`text-[10px] font-semibold ${card.color} mt-1`}>
                      {card.pct}% dari kontak
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Coverage info */}
            {battlefield.belumTahu > 0 && (
              <p className="text-[11px] text-muted-foreground mt-3 text-center">
                {formatNum(battlefield.belumTahu)} orang sudah dikontak tapi belum diketahui dukungannya
              </p>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-border shadow-sm p-4 animate-pulse">
            <div className="h-5 w-40 bg-gray-200 rounded mb-4" />
            <div className="h-10 bg-gray-100 rounded-xl mb-4" />
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-28 bg-gray-50 rounded-xl" />
              ))}
            </div>
          </div>
        )}

        {/* ═══════ STATS ROW ═══════ */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {statsCards.map((card) => {
            const Icon = card.icon;
            if (card.loading || !membersLoaded) {
              return (
                <div
                  key={card.label}
                  className="bg-white rounded-xl border border-border p-2.5 shadow-sm text-center animate-pulse"
                >
                  <div className={`inline-flex p-1 rounded-lg ${card.bg} mb-1`}>
                    <Icon className={`w-3.5 h-3.5 ${card.color}`} />
                  </div>
                  <div className="h-5 w-10 bg-gray-200 rounded mx-auto mb-1" />
                  <p className="text-[10px] text-muted-foreground">{card.label}</p>
                </div>
              );
            }
            return (
              <div
                key={card.label}
                className="bg-white rounded-xl border border-border p-2.5 shadow-sm text-center"
              >
                <div className={`inline-flex p-1 rounded-lg ${card.bg} mb-1`}>
                  <Icon className={`w-3.5 h-3.5 ${card.color}`} />
                </div>
                <p className="text-lg font-bold text-foreground leading-tight">
                  {formatNum(card.value)}
                </p>
                <p className="text-[10px] text-muted-foreground">{card.label}</p>
                {card.sub && (
                  <p className="text-[9px] text-muted-foreground mt-0.5">{card.sub}</p>
                )}
              </div>
            );
          })}
        </div>

        {/* ═══════ CHARTS ═══════ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Dukungan per Angkatan — stacked bar */}
          {bothLoaded ? (
            <div className="bg-white rounded-xl border border-border p-4 shadow-sm">
              <h3 className="font-semibold text-foreground mb-4">
                Peta Dukungan per Angkatan
              </h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={angkatanBattle}
                    margin={{ top: 5, right: 5, left: -10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      dataKey="angkatan"
                      tick={{ fontSize: 10 }}
                      interval={0}
                      angle={-45}
                      textAnchor="end"
                      height={50}
                    />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip content={<AngkatanTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="pendukung" name="Pendukung" fill="#10b981" stackId="a" />
                    <Bar dataKey="ragu" name="Ragu" fill="#eab308" stackId="a" />
                    <Bar dataKey="lawan" name="Pihak Lain" fill="#ef4444" stackId="a" />
                    <Bar
                      dataKey="belumTahu"
                      name="Belum Tahu"
                      fill="#cbd5e1"
                      stackId="a"
                      radius={[2, 2, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <ChartSkeleton title="Peta Dukungan per Angkatan" />
          )}

          {/* Progress Operasional — 4 mini donuts */}
          {bothLoaded ? (
            <div className="bg-white rounded-xl border border-border p-4 shadow-sm">
              <h3 className="font-semibold text-foreground mb-4">
                Progress Operasional
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {progressData.map((p) => {
                  const pct =
                    p.total > 0 ? Math.round((p.value / p.total) * 100) : 0;
                  const chartData = [
                    { name: "Done", value: p.value },
                    { name: "Rest", value: Math.max(0, p.total - p.value) },
                  ];
                  return (
                    <div key={p.label} className="flex flex-col items-center">
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        {p.label}
                      </p>
                      <div className="w-full h-[100px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={chartData}
                              cx="50%"
                              cy="50%"
                              innerRadius={28}
                              outerRadius={42}
                              dataKey="value"
                              startAngle={90}
                              endAngle={-270}
                              strokeWidth={0}
                            >
                              <Cell fill={p.color} />
                              <Cell fill="#f1f5f9" />
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <p className="text-lg font-bold text-foreground">{pct}%</p>
                      <p className="text-xs text-muted-foreground">
                        {formatNum(p.value)}/{formatNum(p.total)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <ChartSkeleton title="Progress Operasional" />
          )}
        </div>

        {/* ═══════ FORM LINKS ═══════ */}
        <div className="bg-white rounded-xl border border-border shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <Link2 className="w-4 h-4 text-[#0B27BC]" />
            <h3 className="font-semibold text-sm text-foreground">
              Link Formulir Publik
            </h3>
          </div>
          <FormLinkRow
            label="Form Dukungan"
            description="Formulir pendaftaran dukungan untuk Aditya Syarief"
            path="/form/dukungan"
            copied={copiedLink}
            onCopy={copyToClipboard}
          />
        </div>
      </div>
    </div>
  );
}
