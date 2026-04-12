"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  ResponsiveContainer,
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
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { useRole } from "@/lib/RoleContext";
import type { Member } from "@/lib/types";
import { formatNum } from "@/lib/format";
import * as XLSX from "xlsx";
import { BatchProgressTab } from "@/components/BatchProgressTab";

/* ── Types ─────────────────────────────────────── */

interface AlumniStats {
  totalAlumni: number;
  linkedAlumni: number;
  alumniByAngkatan: Record<string, number>;
}

interface PerBatchStats {
  angkatan: number;
  totalAlumni: number;
  memberCount: number;
  hasPhone: number;
  contacted: number;
  dukung: number;
  ragu: number;
  sebelah: number;
  grupWa: number;
  dpt: number;
  vote: number;
  campaigners: { user_id: string; email: string }[];
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

/* ── Angkatan Row ────────────────────────────── */

function AngkatanRow({ d }: { d: { angkatan: string; punyaHP: number; kontak: number; pendukung: number; ragu: number; lawan: number; belumTahu: number; alumni: number } }) {
  const total = d.alumni || 1;
  const pctPendukung = (d.pendukung / total) * 100;
  const pctRagu = (d.ragu / total) * 100;
  const pctLawan = (d.lawan / total) * 100;
  const pctUnknown = Math.max(0, 100 - pctPendukung - pctRagu - pctLawan);
  const kontakPct = Math.round((d.kontak / total) * 100);
  const hpPct = Math.round((d.punyaHP / total) * 100);

  return (
    <div className="group relative flex items-center gap-2 py-[6px] px-2 -mx-2 rounded-lg hover:bg-[#0B27BC]/[0.03] transition-colors">
      {/* Label */}
      <span className="text-[11px] font-bold text-[#0B27BC] w-[36px] shrink-0 tabular-nums">
        {d.angkatan}
      </span>

      {/* Alumni count */}
      <span className="text-[10px] text-muted-foreground w-[28px] shrink-0 text-right tabular-nums font-medium">
        {d.alumni}
      </span>

      {/* Stacked dukungan bar */}
      <div className="flex-1 h-[16px] rounded-full overflow-hidden flex bg-[#f0f2f8]">
        {pctPendukung > 0 && (
          <div
            className="h-full transition-all duration-700"
            style={{ width: `${pctPendukung}%`, backgroundColor: "#10b981" }}
          />
        )}
        {pctRagu > 0 && (
          <div
            className="h-full transition-all duration-700"
            style={{ width: `${pctRagu}%`, backgroundColor: "#eab308" }}
          />
        )}
        {pctLawan > 0 && (
          <div
            className="h-full transition-all duration-700"
            style={{ width: `${pctLawan}%`, backgroundColor: "#ef4444" }}
          />
        )}
        {pctUnknown > 0 && (
          <div
            className="h-full transition-all duration-700"
            style={{ width: `${pctUnknown}%`, backgroundColor: "#e2e8f0" }}
          />
        )}
      </div>

      {/* Key metrics as compact pills */}
      <div className="hidden sm:flex items-center gap-1 shrink-0">
        <span className="text-[9px] tabular-nums font-medium px-1.5 py-0.5 rounded bg-[#0B27BC]/8 text-[#0B27BC]">
          {d.punyaHP} HP ({hpPct}%)
        </span>
        <span className="text-[9px] tabular-nums font-medium px-1.5 py-0.5 rounded bg-[#3b82f6]/10 text-[#3b82f6]">
          {d.kontak} Kontak ({kontakPct}%)
        </span>
      </div>

      {/* Pendukung count — the number that matters most */}
      <span className="text-[11px] font-bold text-emerald-600 w-[32px] shrink-0 text-right tabular-nums">
        {d.pendukung}
      </span>

      {/* Hover tooltip with dukungan breakdown */}
      <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 hidden group-hover:flex items-center gap-2.5 bg-white border border-border rounded-lg shadow-lg px-3 py-1.5 z-10 whitespace-nowrap">
        <span className="text-[10px] font-semibold text-emerald-600">{d.pendukung} Dukung</span>
        <span className="text-[10px] font-semibold text-yellow-600">{d.ragu} Ragu</span>
        <span className="text-[10px] font-semibold text-red-500">{d.lawan} Lawan</span>
        <span className="text-[10px] font-medium text-gray-400">{d.belumTahu} Belum</span>
      </div>
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
  const [perBatchStats, setPerBatchStats] = useState<PerBatchStats[]>([]);
  const [perBatchLoaded, setPerBatchLoaded] = useState(false);
  const [formDukunganCount, setFormDukunganCount] = useState(0);
  const { loading: roleLoading, role } = useRole();
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "batch">("overview");
  const [chartSort, setChartSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "angkatan", dir: "asc" });
  const router = useRouter();

  // Redirect campaigner to their target page
  useEffect(() => {
    if (!roleLoading && role === "campaigner") {
      router.replace("/target");
    }
  }, [roleLoading, role, router]);

  useEffect(() => {
    if (roleLoading) return;
    if (role === "campaigner") return; // will redirect
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleLoading]);

  const fetchData = async () => {
    // Fetch all members
    const membersPromise = (async (): Promise<Member[]> => {
      const { data, error } = await supabase
        .from("members")
        .select("*")
        .not("is_non_alumni", "is", true)
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

    // Fetch per-batch stats (server-side, bypasses RLS)
    const perBatchPromise = fetch("/api/alumni/stats/per-batch")
      .then((res) => res.json())
      .catch(() => []);

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
    perBatchPromise.then((bStats: PerBatchStats[]) => {
      setPerBatchStats(Array.isArray(bStats) ? bStats : []);
      setPerBatchLoaded(true);
    });

    // Count distinct members who submitted via /form/dukungan
    (async () => {
      const { data: subs } = await supabase
        .from("form_submissions")
        .select("member_id")
        .eq("type", "dukungan")
        .not("member_id", "is", null);
      const unique = new Set((subs || []).map((s) => s.member_id));
      setFormDukunganCount(unique.size);
    })();
  };

  /* ── Operational Stats (server-side per-batch data for accuracy) ── */
  const opStats = useMemo(() => {
    const totalMembers = perBatchStats.reduce((s, b) => s + b.memberCount, 0);
    const contacted = perBatchStats.reduce((s, b) => s + b.contacted, 0);
    const grupSudah = perBatchStats.reduce((s, b) => s + b.grupWa, 0);
    const dptSudah = perBatchStats.reduce((s, b) => s + b.dpt, 0);
    const voteSudah = perBatchStats.reduce((s, b) => s + b.vote, 0);
    const dukung = perBatchStats.reduce((s, b) => s + b.dukung, 0);
    const ragu = perBatchStats.reduce((s, b) => s + b.ragu, 0);
    const sebelah = perBatchStats.reduce((s, b) => s + b.sebelah, 0);

    return {
      totalAlumni: alumniStats.totalAlumni,
      linkedAlumni: alumniStats.linkedAlumni,
      totalMembers,
      contacted,
      grupSudah,
      grupLinked: waGroupStats.linked,
      grupUnlinked: waGroupStats.unlinked,
      dptSudah,
      voteSudah,
      dukung,
      ragu,
      sebelah,
    };
  }, [perBatchStats, alumniStats, waGroupStats]);

  /* ── Battlefield Stats (from server-side per-batch data for accuracy) ── */
  const battlefield = useMemo(() => {
    const pendukung = opStats.dukung;
    const ragu = opStats.ragu;
    const lawan = opStats.sebelah;
    const contacted = opStats.contacted;
    const known = pendukung + ragu + lawan;
    const belumTahu = Math.max(0, contacted - known);
    const base = opStats.totalMembers || 1;

    return {
      pendukung,
      ragu,
      lawan,
      belumTahu,
      contacted,
      total: opStats.totalMembers,
      pendukungPct: Math.round((pendukung / base) * 100),
      raguPct: Math.round((ragu / base) * 100),
      lawanPct: Math.round((lawan / base) * 100),
    };
  }, [opStats]);

  /* ── Per-Angkatan Battle Data (from server-side API, consistent with target page) ── */
  const angkatanBattle = useMemo(() => {
    return perBatchStats.map((b) => ({
      angkatan: `TN${b.angkatan}`,
      punyaHP: b.hasPhone,
      kontak: b.contacted,
      pendukung: b.dukung,
      ragu: b.ragu,
      lawan: b.sebelah,
      belumTahu: Math.max(0, b.totalAlumni - b.dukung - b.ragu - b.sebelah),
      alumni: b.totalAlumni,
    }));
  }, [perBatchStats]);

  /* ── Sorted Battle Data ── */
  const sortedBattle = useMemo(() => {
    const sorted = [...angkatanBattle];
    const { key, dir } = chartSort;
    sorted.sort((a, b) => {
      let av: number, bv: number;
      if (key === "angkatan") {
        av = parseInt(a.angkatan.replace("TN", ""));
        bv = parseInt(b.angkatan.replace("TN", ""));
      } else {
        av = a[key as keyof typeof a] as number || 0;
        bv = b[key as keyof typeof b] as number || 0;
      }
      return dir === "asc" ? av - bv : bv - av;
    });
    return sorted;
  }, [angkatanBattle, chartSort]);

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

  const bothLoaded = membersLoaded && alumniLoaded && waGroupLoaded && perBatchLoaded;

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
      sub: `${formatNum(opStats.grupLinked)} linked · ${formatNum(opStats.grupUnlinked)} unlinked`,
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
    { label: "Form Dukungan", value: formDukunganCount, total: opStats.totalMembers, color: "#14b8a6" },
    { label: "Kontak", value: opStats.contacted, total: opStats.totalMembers, color: "#0B27BC" },
    { label: "Grup WA", value: opStats.grupSudah, total: opStats.totalMembers, color: "#0B27BC" },
    { label: "DPT", value: opStats.dptSudah, total: opStats.totalMembers, color: "#10b981" },
    { label: "Vote", value: opStats.voteSudah, total: opStats.totalMembers, color: "#84303F" },
  ];

  return (
    <div className="bg-background min-h-screen">
      {/* Header — scrolls with page */}
      <div className="bg-[#0B27BC] text-white">
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
                  setPerBatchLoaded(false);
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
      </div>

      {/* Tab bar — sticky, thin */}
      <div className="sticky top-0 z-40 bg-[#0B27BC] shadow-sm">
        <div className="px-4 sm:px-6 flex gap-0">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-5 py-2 text-[13px] font-semibold transition-colors ${
              activeTab === "overview"
                ? "text-white border-b-[3px] border-[#FE8DA1]"
                : "text-white/60 hover:text-white/80"
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab("batch")}
            className={`px-5 py-2 text-[13px] font-semibold transition-colors ${
              activeTab === "batch"
                ? "text-white border-b-[3px] border-[#FE8DA1]"
                : "text-white/60 hover:text-white/80"
            }`}
          >
            Progress per Batch
          </button>
        </div>
        <div className="h-[2px] bg-gradient-to-r from-[#fcb7c3] via-[#FE8DA1] to-[#fcb7c3]" />
      </div>

      {activeTab === "overview" ? (
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
                dari {formatNum(battlefield.total)} anggota terdata
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
                      {card.pct}% dari anggota
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

        {/* ═══════ PETA DUKUNGAN — CUSTOM VIS ═══════ */}
        {bothLoaded ? (
          <div className="bg-white rounded-xl border border-border p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h3 className="font-semibold text-foreground">
                Peta Dukungan per Angkatan
              </h3>
              <div className="flex items-center gap-2">
                {/* Sort controls */}
                <div className="flex items-center gap-0.5 bg-gray-50 rounded-lg p-0.5">
                  {[
                    { key: "angkatan", label: "Batch" },
                    { key: "pendukung", label: "Dukung" },
                    { key: "punyaHP", label: "HP" },
                    { key: "kontak", label: "Kontak" },
                  ].map((opt) => {
                    const isActive = chartSort.key === opt.key;
                    return (
                      <button
                        key={opt.key}
                        onClick={() => {
                          if (isActive) {
                            setChartSort({ key: opt.key, dir: chartSort.dir === "asc" ? "desc" : "asc" });
                          } else {
                            setChartSort({ key: opt.key, dir: opt.key === "angkatan" ? "asc" : "desc" });
                          }
                        }}
                        className={`inline-flex items-center gap-0.5 px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${
                          isActive
                            ? "bg-[#0B27BC] text-white shadow-sm"
                            : "text-gray-500 hover:text-gray-700"
                        }`}
                      >
                        {opt.label}
                        {isActive && (
                          chartSort.dir === "asc"
                            ? <ArrowUp className="w-2.5 h-2.5" />
                            : <ArrowDown className="w-2.5 h-2.5" />
                        )}
                      </button>
                    );
                  })}
                </div>
                {/* Legend */}
                <div className="hidden sm:flex items-center gap-3">
                  {[
                    { color: "bg-emerald-500", label: "Dukung" },
                    { color: "bg-yellow-400", label: "Ragu" },
                    { color: "bg-red-500", label: "Lawan" },
                    { color: "bg-gray-200", label: "Belum" },
                  ].map((l) => (
                    <div key={l.label} className="flex items-center gap-1">
                      <div className={`w-2 h-2 rounded-full ${l.color}`} />
                      <span className="text-[9px] text-muted-foreground">{l.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 2-column grid on desktop */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6">
              {(() => {
                const mid = Math.ceil(sortedBattle.length / 2);
                const left = sortedBattle.slice(0, mid);
                const right = sortedBattle.slice(mid);
                return [left, right].map((col, ci) => (
                  <div key={ci}>
                    {/* Column header */}
                    <div className="flex items-center gap-2 px-2 pb-1 border-b border-border/50 mb-1">
                      <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium w-[36px]">Batch</span>
                      <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium w-[28px] text-right">Jml</span>
                      <span className="flex-1 text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Dukungan</span>
                      <span className="hidden sm:block text-[9px] uppercase tracking-wider text-muted-foreground font-medium w-[120px]">Metrik</span>
                      <span className="text-[9px] uppercase tracking-wider text-emerald-600 font-medium w-[32px] text-right">Dkng</span>
                    </div>
                    <div className="divide-y divide-border/30">
                      {col.map((d) => (
                        <AngkatanRow key={d.angkatan} d={d} />
                      ))}
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        ) : (
          <ChartSkeleton title="Peta Dukungan per Angkatan" />
        )}

        {/* ═══════ PROGRESS DONUTS — OWN ROW ═══════ */}
        {bothLoaded ? (
          <div className="bg-white rounded-xl border border-border p-4 shadow-sm">
            <h3 className="font-semibold text-foreground mb-4">
              Progress Operasional
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
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
      ) : (
        <div className="px-4 sm:px-6 py-6">
          <BatchProgressTab />
        </div>
      )}
    </div>
  );
}
