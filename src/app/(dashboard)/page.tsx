"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { toPng } from "html-to-image";
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
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  Filter as FilterIcon,
  ShieldCheck,
  Target as TargetIcon,
  AlertOctagon,
  TrendingDown,
} from "lucide-react";
import { useRole } from "@/lib/RoleContext";
import type { Member } from "@/lib/types";
import { formatNum } from "@/lib/format";
import * as XLSX from "xlsx";
import { BatchProgressTab } from "@/components/BatchProgressTab";
import DeadlineBanner from "@/components/DeadlineBanner";
import TierPendukungCard from "@/components/TierPendukungCard";

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
  isiFormDpt: number;
  registrasiWebsiteDpt: number;
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

/* ── Funnel types ───────────────────────────────── */

interface FunnelBucket {
  total: number;
  dukung: number;
  ragu: number;
  sebelah: number;
  belum: number;
}

type FunnelStageKey = "terdata" | "contacted" | "formDpt" | "webDpt" | "dpt" | "vote";

interface FunnelTransition {
  from: FunnelStageKey;
  to: FunnelStageKey;
  fromCount: number;
  toCount: number;
  drop: number;
  dropPct: number;
}

interface FunnelStats {
  overall: Record<FunnelStageKey, FunnelBucket>;
  transitions: FunnelTransition[];
  leakiest: FunnelTransition;
  perAngkatan: {
    angkatan: number;
    alumniTotal: number;
    terdata: FunnelBucket;
    contacted: FunnelBucket;
    formDpt: FunnelBucket;
    webDpt: FunnelBucket;
    dpt: FunnelBucket;
    vote: FunnelBucket;
    bocor: number;
    bocorPct: number;
    coveragePct: number;
    tiersPendukung: {
      aman: number;
      pending_verifikator: number;
      perlu_web: number;
      perlu_gform: number;
      hilang: number;
    };
  }[];
  nextActions: {
    dukungBelumKontak: number;
    dukungBelumForm: number;
    formBelumWeb: number;
    webBelumDpt: number;
    dptBelumVote: number;
    belumKontak: number;
    kontakBelumDukungan: number;
  };
  coverage: {
    totalAlumni: number;
    totalTerdata: number;
    pct: number;
    withPhone: number;
    withPhonePct: number;
    withDukungan: number;
    withDukunganPct: number;
  };
  conversion: {
    terdataToContacted: number;
    contactedToForm: number;
    formToWeb: number;
    webToDpt: number;
    dptToVote: number;
    terdataToVote: number;
  };
  dptMetrics: {
    pendukungTotal: number;
    raguTotal: number;
    belumTahuTotal: number;
    sebelahTotal: number;
    suaraAman: number;
    suaraPotensial: number;
    suaraHilang: number;
    suaraHarusDikejar: number;
  };
  topBocorAngkatan: {
    angkatan: number;
    pendukung: number;
    pendukungDpt: number;
    bocor: number;
    bocorPct: number;
  }[];
  tiers: {
    pendukung: {
      aman: number;
      pending_verifikator: number;
      perlu_web: number;
      perlu_gform: number;
      hilang: number;
    };
    all: {
      aman: number;
      pending_verifikator: number;
      perlu_web: number;
      perlu_gform: number;
      hilang: number;
    };
  };
}

const STAGE_LABELS: Record<FunnelStageKey, string> = {
  terdata: "Terdata",
  contacted: "Terkontak",
  formDpt: "Form DPT",
  webDpt: "Web DPT",
  dpt: "DPT Resmi",
  vote: "Vote",
};

const STAGE_ORDER: FunnelStageKey[] = [
  "terdata",
  "contacted",
  "formDpt",
  "webDpt",
  "dpt",
  "vote",
];

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

/* ── DPT Funnel ────────────────────────────────── */

function FunnelChart({ stats }: { stats: FunnelStats }) {
  const max = stats.overall.terdata.total || 1;
  // Filter out stages with no data (e.g. vote=0 early in campaign) — keep them visible
  // but render as nearly-empty bar so user can still see the shape of the funnel
  return (
    <div className="space-y-2">
      {STAGE_ORDER.map((key, idx) => {
        const bucket = stats.overall[key];
        const pctOfAlumni = (bucket.total / max) * 100;
        const prev = idx > 0 ? stats.overall[STAGE_ORDER[idx - 1]].total : null;
        const conv = prev && prev > 0 ? Math.round((bucket.total / prev) * 100) : null;

        // Stacked segments, as percentages of this stage's total
        const segTotal = bucket.total || 1;
        const segments = [
          { key: "dukung", value: bucket.dukung, color: "#10b981" },
          { key: "ragu", value: bucket.ragu, color: "#eab308" },
          { key: "sebelah", value: bucket.sebelah, color: "#ef4444" },
          { key: "belum", value: bucket.belum, color: "#cbd5e1" },
        ];

        return (
          <div key={key} className="group">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-foreground w-[76px]">
                  {STAGE_LABELS[key]}
                </span>
                <span className="text-sm font-bold text-[#0B27BC] tabular-nums">
                  {formatNum(bucket.total)}
                </span>
                {conv !== null && (
                  <span
                    className={`text-[10px] font-semibold tabular-nums ${
                      conv >= 70
                        ? "text-emerald-600"
                        : conv >= 40
                        ? "text-yellow-600"
                        : "text-red-500"
                    }`}
                  >
                    ↓ {conv}%
                  </span>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {Math.round(pctOfAlumni)}% terdata
              </span>
            </div>
            <div
              className="h-6 rounded-lg bg-gray-100 overflow-hidden flex transition-all"
              style={{ width: `${Math.max(2, pctOfAlumni)}%` }}
            >
              {segments.map((s) => {
                const segPct = (s.value / segTotal) * 100;
                if (segPct < 0.5) return null;
                return (
                  <div
                    key={s.key}
                    className="h-full transition-all duration-700"
                    style={{ width: `${segPct}%`, backgroundColor: s.color }}
                    title={`${s.key}: ${formatNum(s.value)} (${Math.round(segPct)}%)`}
                  />
                );
              })}
            </div>
            {/* dukungan breakdown line */}
            {bucket.total > 0 && (
              <div className="flex items-center gap-3 mt-1 text-[9px] tabular-nums">
                <span className="text-emerald-600 font-medium">
                  ● {formatNum(bucket.dukung)}
                </span>
                <span className="text-yellow-600 font-medium">
                  ● {formatNum(bucket.ragu)}
                </span>
                <span className="text-red-500 font-medium">
                  ● {formatNum(bucket.sebelah)}
                </span>
                <span className="text-gray-400 font-medium">
                  ● {formatNum(bucket.belum)}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Leaky Bucket Card ─────────────────────────── */

const LEAK_MESSAGE: Record<FunnelStageKey, string> = {
  terdata: "terdata",
  contacted: "terkontak",
  formDpt: "isi Form DPT",
  webDpt: "registrasi Web DPT",
  dpt: "masuk DPT resmi",
  vote: "vote",
};

function LeakyCard({ stats }: { stats: FunnelStats }) {
  const leak = stats.leakiest;
  if (!leak || leak.drop <= 0) return null;

  const fromLabel = STAGE_LABELS[leak.from];
  const toLabel = STAGE_LABELS[leak.to];

  const severity =
    leak.dropPct >= 60
      ? { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", icon: "text-red-500" }
      : leak.dropPct >= 30
      ? { bg: "bg-yellow-50", border: "border-yellow-200", text: "text-yellow-700", icon: "text-yellow-500" }
      : { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", icon: "text-emerald-500" };

  return (
    <div
      className={`rounded-xl border-2 ${severity.border} ${severity.bg} p-4`}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className={`w-5 h-5 ${severity.icon} shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-semibold uppercase tracking-wider ${severity.text}`}>
            Tahap Paling Bocor
          </p>
          <p className="text-base font-bold text-foreground mt-0.5">
            {fromLabel} → {toLabel}
          </p>
          <p className={`text-sm ${severity.text} mt-1`}>
            <span className="font-bold">{formatNum(leak.drop)}</span> orang{" "}
            {LEAK_MESSAGE[leak.from]} tapi{" "}
            <span className="font-semibold">belum</span> {LEAK_MESSAGE[leak.to]} (
            {Math.round(leak.dropPct)}% drop-off).
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Next Action Buckets ───────────────────────── */

function NextActionStrip({ stats }: { stats: FunnelStats }) {
  const buckets = [
    { label: "Belum Kontak", value: stats.nextActions.belumKontak, color: "text-gray-700", dot: "bg-gray-400" },
    { label: "Kontak, blm Dukungan", value: stats.nextActions.kontakBelumDukungan, color: "text-[#0B27BC]", dot: "bg-[#0B27BC]" },
    { label: "Dukung, blm Form", value: stats.nextActions.dukungBelumForm, color: "text-emerald-700", dot: "bg-emerald-500" },
    { label: "Form, blm Web DPT", value: stats.nextActions.formBelumWeb, color: "text-yellow-700", dot: "bg-yellow-500" },
    { label: "Web, blm DPT resmi", value: stats.nextActions.webBelumDpt, color: "text-orange-700", dot: "bg-orange-500" },
    { label: "DPT, blm Vote", value: stats.nextActions.dptBelumVote, color: "text-[#84303F]", dot: "bg-[#84303F]" },
  ];
  return (
    <div className="divide-y divide-border">
      {buckets.map((b) => (
        <div
          key={b.label}
          className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className={`w-1.5 h-1.5 rounded-full ${b.dot} flex-shrink-0`} />
            <p className="text-xs text-muted-foreground truncate">{b.label}</p>
          </div>
          <p className={`text-sm font-bold ${b.color} tabular-nums flex-shrink-0`}>
            {formatNum(b.value)}
          </p>
        </div>
      ))}
    </div>
  );
}

/* ── Funnel Heatmap ────────────────────────────── */

function FunnelHeatmap({ stats }: { stats: FunnelStats }) {
  const rows = stats.perAngkatan;
  if (rows.length === 0) return null;

  // For each angkatan, compute % of its alumni reaching each stage
  // Color intensity: 0% = pale gray, 100% = emerald
  const cellColor = (pct: number) => {
    if (pct <= 0) return "rgba(203,213,225,0.25)";
    const clamped = Math.min(100, pct);
    // gradient: gray → emerald
    const opacity = 0.15 + (clamped / 100) * 0.75;
    return `rgba(16,185,129,${opacity.toFixed(2)})`;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-separate border-spacing-[2px]">
        <thead>
          <tr>
            <th className="text-left px-2 py-1 text-[9px] uppercase tracking-wider text-muted-foreground font-medium sticky left-0 bg-white">
              TN
            </th>
            <th className="text-right px-2 py-1 text-[9px] uppercase tracking-wider text-muted-foreground font-medium">
              Terdata
            </th>
            {STAGE_ORDER.slice(1).map((k) => (
              <th
                key={k}
                className="text-center px-2 py-1 text-[9px] uppercase tracking-wider text-muted-foreground font-medium min-w-[68px]"
              >
                {STAGE_LABELS[k]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const base = r.terdata.total || 1;
            return (
              <tr key={r.angkatan}>
                <td className="px-2 py-1 font-bold text-[#0B27BC] text-[11px] tabular-nums sticky left-0 bg-white">
                  TN{r.angkatan}
                </td>
                <td
                  className="px-2 py-1 text-right text-[10px] tabular-nums text-muted-foreground font-medium"
                  title={`${r.terdata.total} dari ${r.alumniTotal} alumni (${Math.round(r.coveragePct)}%)`}
                >
                  {r.terdata.total}
                  <span className="text-gray-300 ml-0.5">/{r.alumniTotal}</span>
                </td>
                {STAGE_ORDER.slice(1).map((k) => {
                  const count = r[k as Exclude<FunnelStageKey, "terdata">].total;
                  const pct = (count / base) * 100;
                  return (
                    <td
                      key={k}
                      className="px-2 py-1 text-center text-[10px] tabular-nums font-semibold text-foreground rounded"
                      style={{ backgroundColor: cellColor(pct) }}
                      title={`${STAGE_LABELS[k]}: ${count}/${r.terdata.total} (${Math.round(pct)}%)`}
                    >
                      {Math.round(pct)}%
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ── DPT Dukungan Metrics (pendukung / ragu / sebelah / belum) ── */

function DptMetricsCard({ stats }: { stats: FunnelStats }) {
  const m = stats.dptMetrics;
  const terdata = stats.coverage.totalTerdata;
  const pctOf = (n: number) => (terdata > 0 ? Math.round((n / terdata) * 100) : 0);

  const cards = [
    {
      label: "Pendukung Kita",
      sub: "Dukung / terkonvert",
      value: m.pendukungTotal,
      icon: ShieldCheck,
      color: "text-emerald-700",
      bg: "bg-emerald-50",
      border: "border-emerald-200",
    },
    {
      label: "Masih Ragu",
      sub: "Bisa diyakinkan",
      value: m.raguTotal,
      icon: HelpCircle,
      color: "text-yellow-700",
      bg: "bg-yellow-50",
      border: "border-yellow-200",
    },
    {
      label: "Pilih Lawan",
      sub: "Sdh pilih sebelah",
      value: m.suaraHilang,
      icon: AlertOctagon,
      color: "text-red-600",
      bg: "bg-red-50",
      border: "border-red-200",
    },
    {
      label: "Belum Ditanya",
      sub: "Belum ada info dukungan",
      value: m.belumTahuTotal,
      icon: TargetIcon,
      color: "text-[#0B27BC]",
      bg: "bg-[#0B27BC]/10",
      border: "border-[#0B27BC]/30",
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm p-4 sm:p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-700" />
          <h3 className="text-base font-bold text-foreground">Peta Dukungan</h3>
        </div>
        <p className="text-[10px] text-muted-foreground">
          dari <span className="font-semibold text-foreground">{formatNum(terdata)}</span> terdata
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {cards.map((c) => {
          const Icon = c.icon;
          const pct = pctOf(c.value);
          return (
            <div key={c.label} className={`rounded-xl border-2 ${c.border} ${c.bg} p-3`}>
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className={`w-3.5 h-3.5 ${c.color}`} />
                <p className={`text-[10px] font-semibold uppercase tracking-wide ${c.color}`}>
                  {c.label}
                </p>
              </div>
              <p className={`text-2xl font-bold ${c.color} tabular-nums leading-tight`}>
                {formatNum(c.value)}
              </p>
              <p className={`text-[10px] font-semibold ${c.color}`}>{pct}% terdata</p>
              <p className="text-[9px] text-muted-foreground mt-0.5 leading-tight">{c.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Vote reminder strip — vote is a reminder goal, not success metric */}
      <div className="pt-3 border-t border-border">
        <div className="flex items-center gap-2 mb-2">
          <Vote className="w-3.5 h-3.5 text-[#0B27BC]" />
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Reminder Vote (dari pendukung kita)
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5">
            <p className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wide">Sudah Vote</p>
            <p className="text-xl font-bold text-emerald-700 tabular-nums leading-tight">{formatNum(m.suaraAman)}</p>
            <p className="text-[9px] text-emerald-700/80">
              {m.pendukungTotal > 0 ? Math.round((m.suaraAman / m.pendukungTotal) * 100) : 0}% pendukung
            </p>
          </div>
          <div className="rounded-lg border border-[#FE8DA1]/40 bg-[#FE8DA1]/15 p-2.5">
            <p className="text-[10px] font-semibold text-[#84303F] uppercase tracking-wide">Perlu Diingatkan</p>
            <p className="text-xl font-bold text-[#84303F] tabular-nums leading-tight">{formatNum(m.suaraHarusDikejar)}</p>
            <p className="text-[9px] text-[#84303F]/80">Pendukung blm vote — kejar hari-H</p>
          </div>
        </div>
      </div>

      {/* Conversion strip — per-stage conversion %, one-line reading */}
      <div className="pt-3 border-t border-border">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Konversi Per Tahap
        </p>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {[
            { label: "Terdata→Kontak", pct: stats.conversion.terdataToContacted },
            { label: "Kontak→Form", pct: stats.conversion.contactedToForm },
            { label: "Form→Web", pct: stats.conversion.formToWeb },
            { label: "Web→DPT", pct: stats.conversion.webToDpt },
            { label: "DPT→Vote", pct: stats.conversion.dptToVote },
          ].map((s) => {
            const pct = Math.round(s.pct);
            const tone =
              pct >= 70 ? "text-emerald-600" : pct >= 40 ? "text-yellow-600" : "text-red-500";
            return (
              <div key={s.label} className="text-center bg-gray-50 rounded-lg p-2 border border-border">
                <p className={`text-lg font-bold ${tone} tabular-nums leading-tight`}>{pct}%</p>
                <p className="text-[9px] text-muted-foreground leading-tight">{s.label}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── Coverage & Team Action panel ────────────── */

function TeamActionPanel({ stats }: { stats: FunnelStats }) {
  const cov = stats.coverage;
  const top = stats.topBocorAngkatan;
  const m = stats.dptMetrics;
  const dptCount = stats.overall.dpt.total;
  const belumTerdata = Math.max(0, cov.totalAlumni - cov.totalTerdata);
  const base = cov.totalAlumni || 1;

  const buckets = [
    {
      label: "DPT Resmi",
      sub: "Di daftar pemilih",
      value: dptCount,
      icon: ClipboardCheck,
      color: "bg-orange-500",
      text: "text-orange-700",
      bg: "bg-orange-50",
      border: "border-orange-200",
    },
    {
      label: "Pendukung Kita",
      sub: "Dukung / terkonvert",
      value: m.pendukungTotal,
      icon: ShieldCheck,
      color: "bg-emerald-500",
      text: "text-emerald-700",
      bg: "bg-emerald-50",
      border: "border-emerald-200",
    },
    {
      label: "Pendukung Lawan",
      sub: "Pilih sebelah",
      value: m.sebelahTotal,
      icon: AlertOctagon,
      color: "bg-red-500",
      text: "text-red-600",
      bg: "bg-red-50",
      border: "border-red-200",
    },
    {
      label: "Ragu-ragu",
      sub: "Bisa diyakinkan",
      value: m.raguTotal,
      icon: HelpCircle,
      color: "bg-yellow-500",
      text: "text-yellow-700",
      bg: "bg-yellow-50",
      border: "border-yellow-200",
    },
    {
      label: "Belum Terdata",
      sub: "Alumni blm masuk sistem",
      value: belumTerdata,
      icon: Users,
      color: "bg-gray-400",
      text: "text-gray-700",
      bg: "bg-gray-50",
      border: "border-gray-200",
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm p-4 sm:p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-[#84303F]" />
          <h3 className="text-base font-bold text-foreground">Analisa Tim</h3>
        </div>
        <p className="text-[10px] text-muted-foreground">
          dari <span className="font-semibold text-foreground">{formatNum(cov.totalAlumni)}</span> alumni
        </p>
      </div>

      {/* 5-way breakdown — DPT vs Pendukung vs Lawan vs Ragu vs Belum Terdata */}
      <div className="space-y-2">
        {buckets.map((b) => {
          const Icon = b.icon;
          const pct = (b.value / base) * 100;
          return (
            <div key={b.label} className={`rounded-lg border ${b.border} ${b.bg} px-2.5 py-2`}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <Icon className={`w-3.5 h-3.5 ${b.text}`} />
                  <span className={`text-[11px] font-semibold ${b.text}`}>{b.label}</span>
                </div>
                <span className={`text-[11px] font-bold ${b.text} tabular-nums`}>
                  {formatNum(b.value)}
                  <span className="text-gray-400 font-normal ml-1">({pct.toFixed(1)}%)</span>
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-white/70 overflow-hidden">
                <div
                  className={`${b.color} h-full transition-all duration-700`}
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>
              <p className="text-[9px] text-muted-foreground mt-0.5 leading-tight">{b.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Top bocor angkatan — pendukung belum masuk DPT */}
      {top.length > 0 && (
        <div className="pt-3 border-t border-border">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            TN Paling Perlu Dibantu — Pendukung blm DPT
          </p>
          <div className="space-y-1.5">
            {top.map((a, idx) => (
              <div
                key={a.angkatan}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-gray-50 border border-border"
              >
                <span className="text-[10px] font-bold text-gray-400 tabular-nums w-4">
                  #{idx + 1}
                </span>
                <span className="text-xs font-bold text-[#0B27BC] tabular-nums w-10">
                  TN{a.angkatan}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] text-muted-foreground">
                      {formatNum(a.pendukungDpt)}/{formatNum(a.pendukung)} pendukung di DPT
                    </span>
                    <span className="text-[10px] font-bold text-red-500 tabular-nums">
                      −{formatNum(a.bocor)} ({Math.round(a.bocorPct)}%)
                    </span>
                  </div>
                  <div className="h-1 rounded-full bg-gray-200 overflow-hidden">
                    <div
                      className="h-full bg-red-400"
                      style={{ width: `${Math.min(100, a.bocorPct)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
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
  const [perBatchStats, setPerBatchStats] = useState<PerBatchStats[]>([]);
  const [perBatchLoaded, setPerBatchLoaded] = useState(false);
  const [funnelStats, setFunnelStats] = useState<FunnelStats | null>(null);
  const [funnelLoaded, setFunnelLoaded] = useState(false);
  const [batchView, setBatchView] = useState<"bar" | "heatmap">("bar");
  const [formDukunganCount, setFormDukunganCount] = useState(0);
  const { loading: roleLoading, role } = useRole();
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "batch">("overview");
  const [chartSort, setChartSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "angkatan", dir: "asc" });
  const [targetDukung, setTargetDukung] = useState<Record<number, number>>({});
  const [targetGroups, setTargetGroups] = useState<{ A1_A5?: number; A6_A12?: number }>({});
  const funnelTableRef = useRef<HTMLDivElement>(null);
  const [downloadingFunnel, setDownloadingFunnel] = useState(false);
  const [funnelSort, setFunnelSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "angkatan", dir: "asc" });
  const [funnelAngkatanFilter, setFunnelAngkatanFilter] = useState<Set<number>>(new Set());
  const toggleFunnelAngkatan = (a: number) => {
    setFunnelAngkatanFilter((prev) => {
      const next = new Set(prev);
      if (next.has(a)) next.delete(a);
      else next.add(a);
      return next;
    });
  };
  const setBasisKekuatan = () => {
    const next = new Set<number>();
    for (let a = 13; a <= 33; a++) next.add(a);
    setFunnelAngkatanFilter(next);
  };
  const setBasisKekuatanLawan = () => {
    const next = new Set<number>();
    for (let a = 1; a <= 12; a++) next.add(a);
    setFunnelAngkatanFilter(next);
  };
  const resetFunnelFilter = () => setFunnelAngkatanFilter(new Set());
  const toggleFunnelSort = (key: string) => {
    setFunnelSort((prev) => {
      if (prev.key === key) return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
      return { key, dir: key === "angkatan" ? "asc" : "desc" };
    });
  };

  const downloadFunnelImage = async () => {
    const node = funnelTableRef.current;
    if (!node) return;
    setDownloadingFunnel(true);
    // Temporarily expand the scroll container so the full table is captured.
    const scrollers = node.querySelectorAll<HTMLElement>(".overflow-y-auto, .overflow-x-auto");
    const prevStyles: { el: HTMLElement; maxHeight: string; overflowY: string; overflowX: string }[] = [];
    scrollers.forEach((el) => {
      prevStyles.push({ el, maxHeight: el.style.maxHeight, overflowY: el.style.overflowY, overflowX: el.style.overflowX });
      el.style.maxHeight = "none";
      el.style.overflowY = "visible";
      el.style.overflowX = "visible";
    });
    try {
      const dataUrl = await toPng(node, {
        backgroundColor: "#ffffff",
        pixelRatio: 2,
        filter: (n) => !(n instanceof HTMLElement && n.dataset.htmlToImageIgnore !== undefined),
      });
      const link = document.createElement("a");
      link.download = `funnel-dpt-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error("download failed", e);
    } finally {
      prevStyles.forEach(({ el, maxHeight, overflowY, overflowX }) => {
        el.style.maxHeight = maxHeight;
        el.style.overflowY = overflowY;
        el.style.overflowX = overflowX;
      });
      setDownloadingFunnel(false);
    }
  };
  const router = useRouter();

  useEffect(() => {
    fetch("/api/angkatan-targets")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j?.value) return;
        const per = j.value.per_angkatan || {};
        const numMap: Record<number, number> = {};
        for (const [k, v] of Object.entries(per)) {
          const n = Number(k);
          if (!isNaN(n) && typeof v === "number") numMap[n] = v;
        }
        setTargetDukung(numMap);
        setTargetGroups(j.value.groups || {});
      })
      .catch(() => { /* silent */ });
  }, []);

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
    // Fetch all members (+ alumni.nosis via join for export)
    const membersPromise = (async (): Promise<Member[]> => {
      const { data, error } = await supabase
        .from("members")
        .select("*, alumni:alumni_id(nosis)")
        .not("is_non_alumni", "is", true)
        .order("no", { ascending: true });
      return !error && data ? (data as unknown as Member[]) : [];
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

    // Fetch funnel stats
    const funnelPromise = fetch("/api/stats/funnel")
      .then((res) => res.json())
      .catch(() => null);

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
    funnelPromise.then((f: FunnelStats | null) => {
      if (f && f.overall) setFunnelStats(f);
      setFunnelLoaded(true);
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
    const isiFormDpt = perBatchStats.reduce((s, b) => s + b.isiFormDpt, 0);
    const registrasiWebsiteDpt = perBatchStats.reduce((s, b) => s + b.registrasiWebsiteDpt, 0);
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
      isiFormDpt,
      registrasiWebsiteDpt,
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
      NOSIS: m.alumni?.nosis || "",
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
    { label: "Form DPT", value: opStats.isiFormDpt, total: opStats.totalMembers, color: "#8b5cf6" },
    { label: "Web DPT", value: opStats.registrasiWebsiteDpt, total: opStats.totalMembers, color: "#a855f7" },
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
                  setFunnelLoaded(false);
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
        <DeadlineBanner />

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

        {/* ═══════ FUNNEL DPT ═══════ */}
        {funnelLoaded && funnelStats ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-white rounded-xl border border-border shadow-sm p-4 sm:p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Vote className="w-5 h-5 text-[#0B27BC]" />
                  <h3 className="text-base font-bold text-foreground">
                    Funnel DPT → Vote
                  </h3>
                </div>
                <div className="hidden sm:flex items-center gap-3">
                  {[
                    { color: "bg-emerald-500", label: "Dukung" },
                    { color: "bg-yellow-400", label: "Ragu" },
                    { color: "bg-red-500", label: "Sebelah" },
                    { color: "bg-gray-300", label: "Belum" },
                  ].map((l) => (
                    <div key={l.label} className="flex items-center gap-1">
                      <div className={`w-2 h-2 rounded-full ${l.color}`} />
                      <span className="text-[9px] text-muted-foreground">{l.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <FunnelChart stats={funnelStats} />
            </div>
            <div className="space-y-3">
              <LeakyCard stats={funnelStats} />
              <div className="bg-white rounded-xl border border-border shadow-sm p-4">
                <div className="flex items-center gap-2 mb-3">
                  <FilterIcon className="w-4 h-4 text-[#0B27BC]" />
                  <h3 className="text-sm font-semibold text-foreground">
                    Butuh Tindak Lanjut
                  </h3>
                </div>
                <NextActionStrip stats={funnelStats} />
              </div>
            </div>
          </div>
        ) : (
          <ChartSkeleton title="Funnel DPT → Vote" />
        )}

        {/* ═══════ DPT METRICS + TEAM ACTION ═══════ */}
        {funnelLoaded && funnelStats && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <DptMetricsCard stats={funnelStats} />
            </div>
            <TeamActionPanel stats={funnelStats} />
          </div>
        )}

        {/* ═══════ TIER PENDUKUNG (DPT registration urgency) ═══════ */}
        {funnelLoaded && funnelStats && (
          <TierPendukungCard
            tiers={funnelStats.tiers.pendukung}
            pendukungTotal={funnelStats.dptMetrics.pendukungTotal}
            subtitle="Tier registrasi DPT per pendukung — yang belum selesai tahap = beresiko hilang suara."
          />
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
                {/* View toggle: bar ↔ heatmap */}
                <div className="flex items-center gap-0.5 bg-gray-50 rounded-lg p-0.5">
                  {[
                    { key: "bar", label: "Bar" },
                    { key: "heatmap", label: "Funnel Heatmap" },
                  ].map((v) => (
                    <button
                      key={v.key}
                      onClick={() => setBatchView(v.key as "bar" | "heatmap")}
                      className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${
                        batchView === v.key
                          ? "bg-[#0B27BC] text-white shadow-sm"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
                {/* Sort controls — only for bar view */}
                {batchView === "bar" && (
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
                )}
                {/* Legend */}
                {batchView === "bar" && (
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
                )}
              </div>
            </div>

            {batchView === "bar" ? (
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
            ) : funnelStats ? (
              <FunnelHeatmap stats={funnelStats} />
            ) : (
              <div className="flex items-center justify-center h-[200px]">
                <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
              </div>
            )}
          </div>
        ) : (
          <ChartSkeleton title="Peta Dukungan per Angkatan" />
        )}

        {/* ═══════ PER ANGKATAN — FUNNEL DPT ═══════ */}
        {funnelLoaded && funnelStats && funnelStats.perAngkatan.length > 0 && (
          <div ref={funnelTableRef} className="bg-white rounded-xl border border-border p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-foreground flex items-center gap-1.5">
                <Vote className="w-4 h-4 text-[#0B27BC]" />
                Per Angkatan — Funnel DPT
              </h3>
              <button
                onClick={downloadFunnelImage}
                disabled={downloadingFunnel}
                data-html-to-image-ignore
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-white bg-[#0B27BC] rounded-lg hover:bg-[#091e94] transition-colors disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                {downloadingFunnel ? "..." : "Download PNG"}
              </button>
            </div>
            <div data-html-to-image-ignore className="mb-3 flex flex-wrap items-center gap-1.5">
              <button
                onClick={setBasisKekuatan}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-md border border-[#84303F]/40 bg-[#84303F]/5 text-[#84303F] hover:bg-[#84303F]/10"
              >
                Basis Kekuatan (A13–A33)
              </button>
              <button
                onClick={setBasisKekuatanLawan}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-md border border-gray-400/40 bg-gray-100 text-gray-700 hover:bg-gray-200"
              >
                Basis Kekuatan Lawan (A1–A12)
              </button>
              {funnelAngkatanFilter.size > 0 && (
                <button
                  onClick={resetFunnelFilter}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-md border border-border bg-white text-gray-600 hover:bg-gray-50"
                >
                  Reset · {funnelAngkatanFilter.size} dipilih
                </button>
              )}
              <span className="text-[10px] text-muted-foreground ml-1">Filter angkatan:</span>
              <div className="flex flex-wrap gap-1">
                {funnelStats.perAngkatan
                  .map((r) => r.angkatan)
                  .sort((a, b) => a - b)
                  .map((a) => {
                    const active = funnelAngkatanFilter.has(a);
                    return (
                      <button
                        key={a}
                        onClick={() => toggleFunnelAngkatan(a)}
                        className={`px-1.5 py-0.5 text-[10px] font-semibold rounded border transition-colors ${
                          active
                            ? "bg-[#0B27BC] text-white border-[#0B27BC]"
                            : "bg-white text-gray-600 border-border hover:bg-gray-50"
                        }`}
                      >
                        A{a}
                      </button>
                    );
                  })}
              </div>
            </div>
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10 bg-white">
                  <tr className="text-[10px] text-muted-foreground border-b border-border">
                    {[
                      { key: "angkatan", label: "Ang", align: "left" },
                      { key: "dukung", label: "Dukung", align: "right" },
                      { key: "formDpt", label: "Form DPT", align: "right" },
                      { key: "webDpt", label: "Web DPT", align: "right" },
                      { key: "dpt", label: "DPT", align: "right" },
                      { key: "dptDukung", label: "DPT+Dukung", align: "right" },
                      { key: "formMinus", label: "Form−(D+D)", align: "right" },
                      { key: "dptMinus", label: "DPT−(D+D)", align: "right" },
                      { key: "menuju50", label: "Δ→50% DPT", align: "right" },
                      { key: "statusOrder", label: "Status", align: "right" },
                    ].map((col) => {
                      const active = funnelSort.key === col.key;
                      return (
                        <th
                          key={col.key}
                          onClick={() => toggleFunnelSort(col.key)}
                          className={`py-1 px-1 bg-white cursor-pointer select-none hover:bg-gray-50 ${col.align === "left" ? "text-left pr-2" : "text-right"} ${active ? "text-[#0B27BC] font-semibold" : ""}`}
                        >
                          <span className="inline-flex items-center gap-0.5">
                            {col.label}
                            {active ? (funnelSort.dir === "asc" ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />) : null}
                          </span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const filteredAng = funnelAngkatanFilter.size > 0
                      ? funnelStats.perAngkatan.filter((r) => funnelAngkatanFilter.has(r.angkatan))
                      : funnelStats.perAngkatan;
                    const sortable = filteredAng.map((r) => {
                      const dptMinus = r.dpt.total - r.dpt.dukung;
                      const dptDukung = r.dpt.dukung;
                      let status: "Win" | "Draw" | "Lose";
                      if (dptDukung > dptMinus) status = "Win";
                      else if (dptDukung === dptMinus) status = "Draw";
                      else status = "Lose";
                      const menuju50raw = (r.dpt.total / 2) - r.dpt.dukung;
                      const menuju50 = menuju50raw < 0 ? 0 : Math.ceil(menuju50raw);
                      return {
                        angkatan: r.angkatan,
                        dukung: r.terdata.dukung,
                        formDpt: r.formDpt.total,
                        webDpt: r.webDpt.total,
                        dpt: r.dpt.total,
                        dptDukung,
                        formMinus: r.formDpt.total - r.dpt.dukung,
                        menuju50,
                        dptMinus,
                        status,
                        statusOrder: status === "Win" ? 2 : status === "Draw" ? 1 : 0,
                      };
                    });
                    sortable.sort((a, b) => {
                      const k = funnelSort.key as keyof typeof a;
                      const av = a[k] as number;
                      const bv = b[k] as number;
                      return funnelSort.dir === "asc" ? av - bv : bv - av;
                    });
                    return sortable.map((r) => (
                      <tr key={r.angkatan} className="border-b border-border/50 hover:bg-gray-50">
                        <td className="py-1 pr-2 font-semibold text-[#0B27BC]">A{r.angkatan}</td>
                        <td className="py-1 px-1 text-right font-semibold text-[#84303F]">
                          {formatNum(r.dukung)}
                        </td>
                        <td className="py-1 px-1 text-right">{formatNum(r.formDpt)}</td>
                        <td className="py-1 px-1 text-right">{formatNum(r.webDpt)}</td>
                        <td className="py-1 px-1 text-right">{formatNum(r.dpt)}</td>
                        <td className="py-1 px-1 text-right font-semibold text-emerald-700">
                          {formatNum(r.dptDukung)}
                          {targetDukung[r.angkatan] ? (
                            <span className="text-[10px] font-normal text-muted-foreground ml-1">
                              / {targetDukung[r.angkatan]} ({Math.round((r.dptDukung / targetDukung[r.angkatan]) * 100)}%)
                            </span>
                          ) : null}
                        </td>
                        <td className="py-1 px-1 text-right text-muted-foreground">{formatNum(r.formMinus)}</td>
                        <td className="py-1 px-1 text-right text-muted-foreground">{formatNum(r.dptMinus)}</td>
                        <td className="py-1 px-1 text-right font-semibold text-[#84303F]">{formatNum(r.menuju50)}</td>
                        <td className="py-1 px-1 text-right">
                          <span className={`inline-block px-1.5 py-0.5 rounded font-bold text-[10px] ${
                            r.status === "Win" ? "bg-emerald-100 text-emerald-700" :
                            r.status === "Draw" ? "bg-yellow-100 text-yellow-700" :
                            "bg-red-100 text-red-700"
                          }`}>
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
                <tfoot className="sticky bottom-0 z-10 bg-white">
                  {(() => {
                    const filteredAng = funnelAngkatanFilter.size > 0
                      ? funnelStats.perAngkatan.filter((r) => funnelAngkatanFilter.has(r.angkatan))
                      : funnelStats.perAngkatan;
                    const totals = filteredAng.reduce(
                      (acc, r) => ({
                        dukung: acc.dukung + r.terdata.dukung,
                        formDpt: acc.formDpt + r.formDpt.total,
                        webDpt: acc.webDpt + r.webDpt.total,
                        dpt: acc.dpt + r.dpt.total,
                        dptDukung: acc.dptDukung + r.dpt.dukung,
                      }),
                      { dukung: 0, formDpt: 0, webDpt: 0, dpt: 0, dptDukung: 0 }
                    );
                    const targetTotal = funnelAngkatanFilter.size > 0
                      ? filteredAng.reduce((s, r) => s + (targetDukung[r.angkatan] ?? 0), 0)
                      : Object.values(targetDukung).reduce((s, v) => s + v, 0) + (targetGroups.A6_A12 ?? 0) + (targetGroups.A1_A5 ?? 0);
                    return (
                      <tr className="border-t-2 border-border font-semibold">
                        <td className="py-1 pr-2 text-[#0B27BC]">Total</td>
                        <td className="py-1 px-1 text-right text-[#84303F]">
                          {formatNum(totals.dukung)}
                        </td>
                        <td className="py-1 px-1 text-right">{formatNum(totals.formDpt)}</td>
                        <td className="py-1 px-1 text-right">{formatNum(totals.webDpt)}</td>
                        <td className="py-1 px-1 text-right">{formatNum(totals.dpt)}</td>
                        <td className="py-1 px-1 text-right text-emerald-700">
                          {formatNum(totals.dptDukung)}
                          {targetTotal > 0 && (
                            <span className="text-[10px] font-normal text-muted-foreground ml-1">
                              / {formatNum(targetTotal)} ({Math.round((totals.dptDukung / targetTotal) * 100)}%)
                            </span>
                          )}
                        </td>
                        <td className="py-1 px-1 text-right text-muted-foreground">{formatNum(totals.formDpt - totals.dptDukung)}</td>
                        <td className="py-1 px-1 text-right text-muted-foreground">{formatNum(totals.dpt - totals.dptDukung)}</td>
                        <td className="py-1 px-1 text-right font-semibold text-[#84303F]">{(() => {
                          const v = (totals.dpt / 2) - totals.dptDukung;
                          return formatNum(v < 0 ? 0 : Math.ceil(v));
                        })()}</td>
                        <td className="py-1 px-1 text-right">
                          {(() => {
                            const dptMinus = totals.dpt - totals.dptDukung;
                            const status = totals.dptDukung > dptMinus ? "Win" : totals.dptDukung === dptMinus ? "Draw" : "Lose";
                            const cls = status === "Win" ? "bg-emerald-100 text-emerald-700" : status === "Draw" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700";
                            return <span className={`inline-block px-1.5 py-0.5 rounded font-bold text-[10px] ${cls}`}>{status}</span>;
                          })()}
                        </td>
                      </tr>
                    );
                  })()}
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* ═══════ PROGRESS DONUTS — OWN ROW ═══════ */}
        {bothLoaded ? (
          <div className="bg-white rounded-xl border border-border p-4 shadow-sm">
            <h3 className="font-semibold text-foreground mb-4">
              Progress Operasional
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
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
