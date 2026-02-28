"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRole } from "@/lib/RoleContext";
import { useToast } from "@/components/Toast";
import { formatNum } from "@/lib/format";
import type { StatusValue } from "@/lib/types";
import {
  Loader2,
  UserPlus,
  MessageCircle,
  ThumbsUp,
  HelpCircle,
  ArrowLeftRight,
  Users as UsersIcon,
  RefreshCw,
  AlertTriangle,
  Crosshair,
  TrendingUp,
  Mail,
} from "lucide-react";

/* ── Types ─────────────────────────────────────────────── */

interface MonitorRow {
  member_id: string;
  alumni_id: string | null;
  nama: string;
  angkatan: number;
  no_hp: string;
  status_dpt: StatusValue;
  sudah_dikontak: StatusValue;
  masuk_grup: StatusValue;
  vote: StatusValue;
  dukungan: string | null;
  attendance_count: number;
  alumni_nosis: string | null;
  alumni_kelanjutan_studi: string | null;
  campaigner_ids: string[];
  campaigner_emails: string[];
}

interface CampaignerInfo {
  user_id: string;
  email: string;
}

interface CampaignerStats {
  total: number;
  kontak: number;
  dukung: number;
  ragu: number;
  sebelah: number;
  grup: number;
  hasPhone: number;
}

/* ── Compute Stats Helper ────────────────────────────── */

function computeStats(members: MonitorRow[]): CampaignerStats {
  return {
    total: members.length,
    kontak: members.filter((r) => r.sudah_dikontak === "Sudah").length,
    dukung: members.filter((r) => r.dukungan === "dukung" || r.dukungan === "terkonvert").length,
    ragu: members.filter((r) => r.dukungan === "ragu_ragu").length,
    sebelah: members.filter((r) => r.dukungan === "milih_sebelah").length,
    grup: members.filter((r) => r.masuk_grup === "Sudah").length,
    hasPhone: members.filter((r) => !!r.no_hp).length,
  };
}

/* ── Progress Bar ────────────────────────────────────── */

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2 flex-1">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-semibold text-gray-500 w-8 text-right">{pct}%</span>
    </div>
  );
}

/* ── Tim Sukses Card ─────────────────────────────────── */

function TimSuksesCard({ title, email, stats, rank }: { title: string; email: string; stats: CampaignerStats; rank: number }) {
  const kontakPct = stats.total > 0 ? Math.round((stats.kontak / stats.total) * 100) : 0;
  const dukungPct = stats.total > 0 ? Math.round((stats.dukung / stats.total) * 100) : 0;
  const grupPct = stats.total > 0 ? Math.round((stats.grup / stats.total) * 100) : 0;

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      <div className="px-4 py-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-[#0B27BC]/10 flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-[#0B27BC]">{rank}</span>
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground truncate">{title}</h3>
              <p className="text-[10px] text-muted-foreground truncate flex items-center gap-1">
                <Mail className="w-3 h-3 shrink-0" />
                {email}
              </p>
            </div>
          </div>
          <div className="text-right shrink-0 ml-2">
            <p className="text-lg font-bold text-[#0B27BC]">{formatNum(stats.total)}</p>
            <p className="text-[9px] text-muted-foreground">target</p>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 mb-3">
          {[
            { label: "Kontak", value: stats.kontak, color: "text-[#0B27BC]" },
            { label: "Dukung", value: stats.dukung, color: "text-emerald-600" },
            { label: "Ragu", value: stats.ragu, color: "text-yellow-600" },
            { label: "Sebelah", value: stats.sebelah, color: "text-red-600" },
            { label: "Grup", value: stats.grup, color: "text-[#84303F]" },
            { label: "No HP", value: stats.hasPhone, color: "text-gray-600" },
          ].map((s) => (
            <div key={s.label} className="text-center px-1 py-1 rounded-lg bg-gray-50">
              <p className={`text-sm font-bold ${s.color} leading-tight`}>{formatNum(s.value)}</p>
              <p className="text-[9px] text-gray-400">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Progress bars */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-gray-400 w-12 shrink-0">Kontak</span>
            <ProgressBar value={stats.kontak} max={stats.total} color="bg-[#0B27BC]" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-gray-400 w-12 shrink-0">Dukung</span>
            <ProgressBar value={stats.dukung} max={stats.total} color="bg-emerald-500" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-gray-400 w-12 shrink-0">Grup WA</span>
            <ProgressBar value={stats.grup} max={stats.total} color="bg-[#84303F]" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ─────────────────────────────────────────── */

export default function AdminAssignmentsPage() {
  const { canManageUsers: userCanManage, loading: roleLoading } = useRole();
  const { showToast } = useToast();

  const [rows, setRows] = useState<MonitorRow[]>([]);
  const [campaigners, setCampaigners] = useState<CampaignerInfo[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoadingData(true);
    try {
      const res = await fetch("/api/assignments/monitor");
      if (res.ok) {
        const data = await res.json();
        setRows(data.members || []);
        setCampaigners(data.campaigners || []);
      } else {
        showToast("Gagal memuat data monitoring", "error");
      }
    } catch {
      showToast("Gagal memuat data monitoring", "error");
    }
    setLoadingData(false);
  }, [showToast]);

  useEffect(() => {
    if (roleLoading) return;
    if (userCanManage) fetchData();
    else setLoadingData(false);
  }, [fetchData, roleLoading, userCanManage]);

  // Global stats
  const globalStats = useMemo(() => computeStats(rows), [rows]);

  // Group members by campaigner and build cards
  const campaignerCards = useMemo(() => {
    const cards: { id: string; title: string; email: string; stats: CampaignerStats }[] = [];

    for (const c of campaigners) {
      const members = rows.filter((r) => r.campaigner_ids.includes(c.user_id));
      if (members.length === 0) continue;
      cards.push({
        id: c.user_id,
        title: c.email.split("@")[0],
        email: c.email,
        stats: computeStats(members),
      });
    }

    // Sort by dukung percentage descending (performance ranking)
    cards.sort((a, b) => {
      const aPct = a.stats.total > 0 ? a.stats.dukung / a.stats.total : 0;
      const bPct = b.stats.total > 0 ? b.stats.dukung / b.stats.total : 0;
      return bPct - aPct;
    });

    return cards;
  }, [rows, campaigners]);

  // Unassigned count
  const unassignedCount = useMemo(() => {
    return rows.filter((r) => r.campaigner_ids.length === 0).length;
  }, [rows]);

  if (roleLoading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#0B27BC]" />
          <p className="text-sm text-muted-foreground">Memuat data monitoring...</p>
        </div>
      </div>
    );
  }

  if (!userCanManage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-center px-4">
          <div className="p-3 rounded-full bg-red-100">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Akses Ditolak</h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            Anda tidak memiliki izin untuk mengakses halaman ini.
          </p>
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
              <UserPlus className="w-5 h-5 text-[#FE8DA1]" />
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-white">Monitoring Tim Sukses</h1>
                <p className="text-xs text-white/70">
                  {formatNum(campaignerCards.length)} Tim Sukses · {formatNum(globalStats.total)} target
                </p>
              </div>
            </div>
            <button onClick={fetchData} className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-[#0B27BC] bg-white rounded-lg hover:bg-gray-100 transition-colors">
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
        <div className="h-1 bg-gradient-to-r from-[#fcb7c3] via-[#FE8DA1] to-[#fcb7c3]" />
      </header>

      <div className="px-4 sm:px-6 py-6 space-y-4">
        {/* Global Stats */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {[
            { label: "Total", value: globalStats.total, icon: Crosshair, color: "text-[#0B27BC]", bg: "bg-[#0B27BC]/10" },
            { label: "Kontak", value: globalStats.kontak, icon: MessageCircle, color: "text-[#0B27BC]", bg: "bg-[#0B27BC]/10" },
            { label: "Dukung", value: globalStats.dukung, icon: ThumbsUp, color: "text-emerald-700", bg: "bg-emerald-50" },
            { label: "Ragu", value: globalStats.ragu, icon: HelpCircle, color: "text-yellow-700", bg: "bg-yellow-50" },
            { label: "Sebelah", value: globalStats.sebelah, icon: ArrowLeftRight, color: "text-red-700", bg: "bg-red-50" },
            { label: "Grup", value: globalStats.grup, icon: UsersIcon, color: "text-[#84303F]", bg: "bg-[#84303F]/10" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-border p-2.5 shadow-sm text-center">
              <div className={`inline-flex p-1 rounded-lg ${s.bg} mb-1`}>
                <s.icon className={`w-3.5 h-3.5 ${s.color}`} />
              </div>
              <p className="text-lg font-bold text-foreground leading-tight">{formatNum(s.value)}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tim Sukses Cards */}
        {campaignerCards.length === 0 ? (
          <div className="bg-white rounded-xl border border-border shadow-sm p-12 text-center">
            <Crosshair className="w-8 h-8 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Belum ada data Tim Sukses.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#0B27BC]" />
                Ranking Tim Sukses
              </h2>
              {unassignedCount > 0 && (
                <span className="text-[10px] px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 font-medium">
                  {formatNum(unassignedCount)} belum ditugaskan
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {campaignerCards.map((card, idx) => (
                <TimSuksesCard
                  key={card.id}
                  title={card.title}
                  email={card.email}
                  stats={card.stats}
                  rank={idx + 1}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
