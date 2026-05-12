"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRole } from "@/lib/RoleContext";
import { useToast } from "@/components/Toast";
import DeadlineBanner from "@/components/DeadlineBanner";
import TierPendukungCard from "@/components/TierPendukungCard";
import { formatNum } from "@/lib/format";
import type { StatusValue } from "@/lib/types";
import { classifyTier, type DptTier } from "@/lib/dptDeadline";
import {
  Search,
  Loader2,
  Crosshair,
  Phone,
  MessageCircle,
  CalendarCheck,
  RefreshCw,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  ArrowRight,
  ClipboardCheck,
  Smartphone,
  Vote as VoteIcon,
  Users as UsersIcon,
  BarChart3,
  ShieldCheck,
  Target as TargetIcon,
  AlertOctagon,
  HelpCircle,
  Flame,
} from "lucide-react";
import * as XLSX from "xlsx";

/* ── Constants ────────────────────────────────────────── */

const PAGE_SIZE = 50;

/* ── Types ─────────────────────────────────────────────── */

interface TargetRow {
  alumni_id: string;
  alumni_nama: string;
  alumni_angkatan: number;
  alumni_nosis: string | null;
  alumni_kelanjutan_studi: string | null;
  member_id: string | null;
  no: number | null;
  nama: string;
  angkatan: number;
  no_hp: string;
  status_dpt: StatusValue;
  isi_form_dpt: StatusValue;
  registrasi_website_dpt: StatusValue;
  sudah_dikontak: StatusValue;
  masuk_grup: StatusValue;
  vote: StatusValue;
  dukungan: string | null;
  attendance_count: number;
}

/* ── Dukungan config ───────────────────────────────────── */

const DUKUNGAN_SELECT_STYLES: Record<string, string> = {
  dukung: "bg-emerald-100 text-emerald-700 border-emerald-200",
  ragu_ragu: "bg-yellow-100 text-yellow-700 border-yellow-200",
  milih_sebelah: "bg-red-100 text-red-700 border-red-200",
  terkonvert: "bg-blue-100 text-blue-700 border-blue-200",
};

/* ── Inline Phone Edit ─────────────────────────────────── */

function InlinePhoneEdit({
  value,
  onSave,
}: {
  value: string;
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editing]);

  const save = () => {
    // Strip all non-digit characters before saving
    const digitsOnly = draft.replace(/\D/g, "");
    if (digitsOnly !== value) {
      onSave(digitsOnly);
    }
    setDraft(digitsOnly);
    setEditing(false);
  };

  if (!editing) {
    return (
      <button
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        className="text-xs text-left w-full px-2 py-1 rounded hover:bg-gray-100 transition-colors min-w-[90px] truncate"
      >
        {value || (
          <span className="text-gray-300 italic">+ No HP</span>
        )}
      </button>
    );
  }

  return (
    <div className="relative min-w-[90px]">
      <input
        ref={inputRef}
        type="tel"
        inputMode="numeric"
        value={draft}
        onChange={(e) => {
          // Only allow digits
          const cleaned = e.target.value.replace(/\D/g, "");
          setDraft(cleaned);
        }}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        className="text-xs w-full px-2 py-1 border border-[#0B27BC] rounded focus:outline-none focus:ring-1 focus:ring-[#0B27BC]/30"
        placeholder="628xxxxxxxxxx"
      />
      <p className="text-[9px] text-[#0B27BC]/70 mt-0.5 px-1">
        Awali dengan kode negara, misal 628xxx (bukan 08xxx)
      </p>
    </div>
  );
}

/* ── Status Chip (binary) ──────────────────────────────── */

function StatusChip({
  value,
  onClick,
  disabled,
  readOnly,
}: {
  value: StatusValue;
  onClick?: () => void;
  disabled?: boolean;
  readOnly?: boolean;
}) {
  const isSudah = value === "Sudah";

  if (readOnly) {
    return (
      <span
        className={`text-[10px] px-2 py-1 rounded-full font-medium whitespace-nowrap inline-block ${
          isSudah
            ? "bg-emerald-100/60 text-emerald-600"
            : "bg-gray-50 text-gray-300"
        }`}
        title={isSudah ? "Otomatis dari WA Group" : "Belum di WA Group"}
      >
        {isSudah ? "Sudah" : "Belum"}
      </span>
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`text-[10px] px-2 py-1 rounded-full font-medium transition-all whitespace-nowrap cursor-pointer border ${
        isSudah
          ? "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200 hover:border-emerald-300"
          : "bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200 hover:border-gray-300"
      } active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed`}
      title="Klik untuk mengubah"
    >
      {isSudah ? "Sudah" : "Belum"}
    </button>
  );
}

/* ── Dukungan Select ──────────────────────────────────── */

function DukunganSelect({
  value,
  onChange,
  disabled,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  disabled?: boolean;
}) {
  const style = value
    ? DUKUNGAN_SELECT_STYLES[value] || "bg-gray-100 text-gray-500 border-gray-200"
    : "bg-gray-100 text-gray-500 border-gray-200";

  return (
    <select
      value={value || ""}
      onChange={(e) => onChange(e.target.value || null)}
      disabled={disabled}
      className={`text-[10px] pl-1.5 pr-5 py-1 rounded-full font-medium border cursor-pointer transition-all appearance-none bg-[length:12px] bg-[right_4px_center] bg-no-repeat disabled:opacity-50 disabled:cursor-not-allowed ${style}`}
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
      }}
    >
      <option value="">—</option>
      <option value="dukung">Dukung</option>
      <option value="ragu_ragu">Ragu</option>
      <option value="milih_sebelah">Sebelah</option>
      <option value="terkonvert">Convert</option>
    </select>
  );
}

/* ── Next Action logic ─────────────────────────────────── */

interface NextAction {
  key: "kontak" | "dukungan" | "form" | "web" | "dpt" | "vote" | "done";
  label: string;
  priority: number; // lower = more urgent
  color: string;
}

/**
 * Computes the next action for a target row. Priority order is based on the
 * funnel: the earliest missing stage is what the campaigner should focus on.
 * Dukungan=sebelah short-circuits (no further action needed — already a loss).
 */
function computeNextAction(row: TargetRow): NextAction {
  // Lawan → won't convert, lowest priority
  if (row.dukungan === "milih_sebelah") {
    return { key: "done", label: "—", priority: 99, color: "text-red-400" };
  }
  // Stage 1: contact (including implicit via WA group)
  const contacted = row.sudah_dikontak === "Sudah" || row.masuk_grup === "Sudah";
  if (!contacted) {
    return { key: "kontak", label: "Hubungi dulu", priority: 1, color: "text-[#0B27BC]" };
  }
  // Stage 2: know dukungan
  if (!row.dukungan) {
    return { key: "dukungan", label: "Tanya Dukungan", priority: 2, color: "text-[#0B27BC]" };
  }
  // Only keep pushing supporters & undecided (not sebelah, already handled above)
  const push = row.dukungan === "dukung" || row.dukungan === "terkonvert" || row.dukungan === "ragu_ragu";
  if (!push) {
    return { key: "done", label: "—", priority: 98, color: "text-gray-400" };
  }
  // Stage 3-6: DPT funnel
  if (row.isi_form_dpt !== "Sudah") {
    return { key: "form", label: "Ajak Isi Form DPT", priority: 3, color: "text-emerald-600" };
  }
  if (row.registrasi_website_dpt !== "Sudah") {
    return { key: "web", label: "Ingatkan Web DPT", priority: 4, color: "text-yellow-600" };
  }
  if (row.status_dpt !== "Sudah") {
    return { key: "dpt", label: "Cek DPT resmi", priority: 5, color: "text-orange-600" };
  }
  if (row.vote !== "Sudah") {
    return { key: "vote", label: "Pengingat Vote", priority: 6, color: "text-[#84303F]" };
  }
  return { key: "done", label: "✅ Lengkap", priority: 10, color: "text-emerald-700" };
}

/* ── Progress Dots (compact stage indicator) ───────────── */

function ProgressDots({ row }: { row: TargetRow }) {
  const stages = [
    { key: "kontak", on: row.sudah_dikontak === "Sudah" || row.masuk_grup === "Sudah", label: "Kontak" },
    { key: "dukungan", on: row.dukungan === "dukung" || row.dukungan === "terkonvert", label: "Dukung" },
    { key: "form", on: row.isi_form_dpt === "Sudah", label: "Form DPT" },
    { key: "web", on: row.registrasi_website_dpt === "Sudah", label: "Web DPT" },
    { key: "dpt", on: row.status_dpt === "Sudah", label: "DPT" },
    { key: "vote", on: row.vote === "Sudah", label: "Vote" },
  ];
  const done = stages.filter((s) => s.on).length;
  return (
    <div
      className="inline-flex items-center gap-0.5"
      title={stages.map((s) => `${s.on ? "●" : "○"} ${s.label}`).join("  ")}
    >
      {stages.map((s) => (
        <span
          key={s.key}
          className={`inline-block w-1.5 h-1.5 rounded-full ${
            s.on ? "bg-emerald-500" : "bg-gray-200"
          }`}
        />
      ))}
      <span className="text-[9px] text-muted-foreground ml-1 tabular-nums font-medium">
        {done}/6
      </span>
    </div>
  );
}

/* ── Preset filter shortcuts ───────────────────────────── */

type PresetKey =
  | "all"
  | "belumKontak"
  | "kontakBelumDukungan"
  | "dukungBelumForm"
  | "formBelumWeb"
  | "webBelumDpt"
  | "dptBelumVote";

const PRESET_DEFS: { key: PresetKey; label: string; color: string }[] = [
  { key: "all", label: "Semua", color: "bg-gray-100 text-gray-700 border-gray-300" },
  { key: "belumKontak", label: "Belum Kontak", color: "bg-white text-gray-700 border-gray-300" },
  { key: "kontakBelumDukungan", label: "Kontak, blm Dukungan", color: "bg-[#0B27BC]/10 text-[#0B27BC] border-[#0B27BC]/30" },
  { key: "dukungBelumForm", label: "Dukung, blm Form", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { key: "formBelumWeb", label: "Form, blm Web DPT", color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  { key: "webBelumDpt", label: "Web, blm DPT resmi", color: "bg-orange-50 text-orange-700 border-orange-200" },
  { key: "dptBelumVote", label: "DPT, blm Vote", color: "bg-[#84303F]/10 text-[#84303F] border-[#84303F]/30" },
];

function presetMatch(row: TargetRow, key: PresetKey): boolean {
  const contacted = row.sudah_dikontak === "Sudah" || row.masuk_grup === "Sudah";
  const pendukung = row.dukungan === "dukung" || row.dukungan === "terkonvert";
  switch (key) {
    case "all": return true;
    case "belumKontak": return !contacted;
    case "kontakBelumDukungan": return contacted && !row.dukungan;
    case "dukungBelumForm": return pendukung && row.isi_form_dpt !== "Sudah";
    case "formBelumWeb": return row.isi_form_dpt === "Sudah" && row.registrasi_website_dpt !== "Sudah";
    case "webBelumDpt": return row.registrasi_website_dpt === "Sudah" && row.status_dpt !== "Sudah";
    case "dptBelumVote": return row.status_dpt === "Sudah" && row.vote !== "Sudah";
  }
}

/* ── Main Page ─────────────────────────────────────────── */

export default function TargetPage() {
  const { canEdit: userCanEdit, role: userRole, loading: roleLoading } = useRole();
  const isCampaigner = userRole === "campaigner";
  const { showToast } = useToast();
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;

  const [allTargets, setAllTargets] = useState<TargetRow[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);

  // Search (debounced)
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Filters
  const [filterAngkatan, setFilterAngkatan] = useState<string>("all");
  const [activePreset, setActivePreset] = useState<PresetKey>("all");
  const [sortByPriority, setSortByPriority] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [dashboardMode, setDashboardMode] = useState(false);
  const [fKontak, setFKontak] = useState("all");
  const [fDukungan, setFDukungan] = useState("all");
  const [fGrup, setFGrup] = useState("all");
  const [fDpt, setFDpt] = useState("all");
  const [fFormDpt, setFFormDpt] = useState("all");
  const [fWebDpt, setFWebDpt] = useState("all");
  const [fVote, setFVote] = useState("all");
  const [fPhone, setFPhone] = useState("all");

  const activeFilterCount = [fKontak, fDukungan, fGrup, fDpt, fFormDpt, fWebDpt, fVote, fPhone].filter((f) => f !== "all").length;

  const resetFilters = () => {
    setFKontak("all");
    setFDukungan("all");
    setFGrup("all");
    setFDpt("all");
    setFFormDpt("all");
    setFWebDpt("all");
    setFVote("all");
    setFPhone("all");
  };

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Reset page on any filter change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filterAngkatan, activePreset, sortByPriority, fKontak, fDukungan, fGrup, fDpt, fFormDpt, fWebDpt, fVote, fPhone]);

  // ── Data loading (NO loading state inside) ──
  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/targets");
      if (res.ok) {
        const data = await res.json();
        setAllTargets(data);
      } else {
        showToastRef.current("Gagal memuat data target", "error");
      }
    } catch {
      showToastRef.current("Gagal memuat data target", "error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // Fetch once on mount (re-run when roleLoading flips to false)
  useEffect(() => {
    if (roleLoading) return;
    let cancelled = false;
    (async () => {
      await loadData();
      if (!cancelled) setInitialLoading(false);
    })();
    return () => { cancelled = true; };
  }, [roleLoading, loadData]);

  // Available angkatan from data
  const availableAngkatan = useMemo(() => {
    const set = new Set<number>();
    allTargets.forEach((t) => set.add(t.angkatan));
    return Array.from(set).sort((a, b) => a - b);
  }, [allTargets]);

  // Stats — funnel counts + preset counts + DPT metrics
  const stats = useMemo(() => {
    const total = allTargets.length;
    let kontak = 0, dukung = 0, formDpt = 0, webDpt = 0, dpt = 0, vote = 0, grup = 0;
    let withHP = 0, ragu = 0, sebelah = 0, belumTahu = 0;
    let suaraAman = 0, suaraPotensial = 0, suaraHarusDikejar = 0;
    const tiersPendukung: Record<DptTier, number> = {
      aman: 0, pending_verifikator: 0, perlu_web: 0, perlu_gform: 0, hilang: 0,
    };
    const now = new Date();
    const presetCounts: Record<PresetKey, number> = {
      all: total,
      belumKontak: 0,
      kontakBelumDukungan: 0,
      dukungBelumForm: 0,
      formBelumWeb: 0,
      webBelumDpt: 0,
      dptBelumVote: 0,
    };
    const byAngkatan: Record<number, {
      angkatan: number;
      total: number;
      kontak: number;
      dukung: number;
      formDpt: number;
      webDpt: number;
      dpt: number;
      vote: number;
    }> = {};
    const ensure = (a: number) => {
      if (!byAngkatan[a]) {
        byAngkatan[a] = { angkatan: a, total: 0, kontak: 0, dukung: 0, formDpt: 0, webDpt: 0, dpt: 0, vote: 0 };
      }
      return byAngkatan[a];
    };
    for (const t of allTargets) {
      const contacted = t.sudah_dikontak === "Sudah" || t.masuk_grup === "Sudah";
      const pendukung = t.dukungan === "dukung" || t.dukungan === "terkonvert";
      const tIsVote = t.vote === "Sudah";
      const tIsDpt = t.status_dpt === "Sudah";
      const pa = ensure(t.angkatan);
      pa.total++;
      if (contacted) { kontak++; pa.kontak++; }
      if (pendukung) { dukung++; pa.dukung++; }
      if (t.dukungan === "ragu_ragu") ragu++;
      if (t.dukungan === "milih_sebelah") sebelah++;
      if (!t.dukungan) belumTahu++;
      if (t.masuk_grup === "Sudah") grup++;
      if (t.isi_form_dpt === "Sudah") { formDpt++; pa.formDpt++; }
      if (t.registrasi_website_dpt === "Sudah") { webDpt++; pa.webDpt++; }
      if (tIsDpt) { dpt++; pa.dpt++; }
      if (tIsVote) { vote++; pa.vote++; }
      if (t.no_hp && t.no_hp.trim().length > 0) withHP++;
      if (pendukung && tIsVote) suaraAman++;
      if (tIsDpt && !tIsVote && (pendukung || t.dukungan === "ragu_ragu")) suaraPotensial++;

      if (pendukung) {
        const tier = classifyTier(
          {
            isi_form_dpt: t.isi_form_dpt,
            registrasi_website_dpt: t.registrasi_website_dpt,
            status_dpt: t.status_dpt,
          },
          now,
        );
        tiersPendukung[tier]++;
      }

      for (const k of ["belumKontak", "kontakBelumDukungan", "dukungBelumForm", "formBelumWeb", "webBelumDpt", "dptBelumVote"] as PresetKey[]) {
        if (presetMatch(t, k)) presetCounts[k]++;
      }
    }
    suaraHarusDikejar = dukung - suaraAman;
    const perAngkatan = Object.values(byAngkatan).sort((a, b) => a.angkatan - b.angkatan);
    return {
      total, kontak, dukung, formDpt, webDpt, dpt, vote, grup,
      withHP, ragu, sebelah, belumTahu,
      suaraAman, suaraPotensial, suaraHarusDikejar,
      tiersPendukung,
      presetCounts, perAngkatan,
    };
  }, [allTargets]);

  // Top 5 priority targets — who to contact first
  const topPriority = useMemo(() => {
    return [...allTargets]
      .map((t) => ({ row: t, action: computeNextAction(t) }))
      .filter((x) => x.action.priority < 10)
      .sort((a, b) => {
        if (a.action.priority !== b.action.priority) return a.action.priority - b.action.priority;
        return a.row.nama.localeCompare(b.row.nama);
      })
      .slice(0, 5);
  }, [allTargets]);

  // Filter targets — per-column
  const filtered = useMemo(() => {
    const base = allTargets.filter((t) => {
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase();
        if (!t.nama.toLowerCase().includes(q) && !(t.no_hp && t.no_hp.includes(debouncedSearch))) return false;
      }
      if (filterAngkatan !== "all" && t.angkatan !== Number(filterAngkatan)) return false;
      if (activePreset !== "all" && !presetMatch(t, activePreset)) return false;

      // Per-column filters
      if (fKontak !== "all") {
        if (fKontak === "Belum") { if (t.sudah_dikontak !== null && t.sudah_dikontak !== "Belum") return false; }
        else if (t.sudah_dikontak !== fKontak) return false;
      }
      if (fDukungan !== "all") {
        if (fDukungan === "pendukung") { if (t.dukungan !== "dukung" && t.dukungan !== "terkonvert") return false; }
        else if (fDukungan === "empty") { if (t.dukungan) return false; }
        else if (t.dukungan !== fDukungan) return false;
      }
      if (fGrup !== "all") {
        if (t.masuk_grup !== fGrup) return false;
      }
      if (fDpt !== "all") {
        if (fDpt === "Belum") { if (t.status_dpt !== null && t.status_dpt !== "Belum") return false; }
        else if (t.status_dpt !== fDpt) return false;
      }
      if (fFormDpt !== "all") {
        if (fFormDpt === "Belum") { if (t.isi_form_dpt !== null && t.isi_form_dpt !== "Belum") return false; }
        else if (t.isi_form_dpt !== fFormDpt) return false;
      }
      if (fWebDpt !== "all") {
        if (fWebDpt === "Belum") { if (t.registrasi_website_dpt !== null && t.registrasi_website_dpt !== "Belum") return false; }
        else if (t.registrasi_website_dpt !== fWebDpt) return false;
      }
      if (fVote !== "all") {
        if (fVote === "Belum") { if (t.vote !== null && t.vote !== "Belum") return false; }
        else if (t.vote !== fVote) return false;
      }
      if (fPhone !== "all") {
        if (fPhone === "has" && !t.no_hp) return false;
        if (fPhone === "empty" && t.no_hp) return false;
      }

      return true;
    });

    if (sortByPriority) {
      return [...base].sort((a, b) => {
        const pa = computeNextAction(a).priority;
        const pb = computeNextAction(b).priority;
        if (pa !== pb) return pa - pb;
        return a.nama.localeCompare(b.nama);
      });
    }
    return base;
  }, [allTargets, debouncedSearch, filterAngkatan, activePreset, sortByPriority, fKontak, fDukungan, fGrup, fDpt, fFormDpt, fWebDpt, fVote, fPhone]);

  // Client-side pagination
  const totalFiltered = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const targets = useMemo(() => {
    const offset = (safePage - 1) * PAGE_SIZE;
    return filtered.slice(offset, offset + PAGE_SIZE);
  }, [filtered, safePage]);

  const goPage = (p: number) => setPage(Math.max(1, Math.min(totalPages, p)));

  // Update handler
  const handleFieldUpdate = useCallback(
    async (row: TargetRow, field: string, value: string | null) => {
      // Optimistic update
      setAllTargets((prev) =>
        prev.map((t) =>
          t.alumni_id === row.alumni_id ? { ...t, [field]: value } : t
        )
      );

      if (row.member_id) {
        // Member exists — PATCH directly
        try {
          const res = await fetch(`/api/members/${row.member_id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ [field]: value }),
          });
          if (!res.ok) {
            loadData();
            showToastRef.current("Gagal mengupdate", "error");
          }
        } catch {
          loadData();
          showToastRef.current("Gagal mengupdate", "error");
        }
      } else {
        // No member yet — POST to create + update
        try {
          const res = await fetch("/api/targets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ alumni_id: row.alumni_id, field, value }),
          });
          if (res.ok) {
            const data = await res.json();
            setAllTargets((prev) =>
              prev.map((t) =>
                t.alumni_id === row.alumni_id
                  ? {
                      ...t,
                      member_id: data.member_id,
                      no: data.member?.no || t.no,
                      no_hp: data.member?.no_hp || t.no_hp,
                      status_dpt: data.member?.status_dpt ?? t.status_dpt,
                      isi_form_dpt: data.member?.isi_form_dpt ?? t.isi_form_dpt,
                      registrasi_website_dpt: data.member?.registrasi_website_dpt ?? t.registrasi_website_dpt,
                      sudah_dikontak: data.member?.sudah_dikontak ?? t.sudah_dikontak,
                      // masuk_grup is derived from WA Group — keep existing value
                      vote: data.member?.vote ?? t.vote,
                      dukungan: data.member?.dukungan ?? t.dukungan,
                    }
                  : t
              )
            );
          } else {
            loadData();
            showToastRef.current("Gagal membuat data anggota", "error");
          }
        } catch {
          loadData();
          showToastRef.current("Gagal membuat data anggota", "error");
        }
      }
    },
    [loadData]
  );

  // Toggle binary field
  const toggleBinary = (row: TargetRow, field: string) => {
    const current = row[field as keyof TargetRow] as StatusValue;
    const next = current === "Sudah" ? "Belum" : "Sudah";
    handleFieldUpdate(row, field, next);
  };

  /* ── Excel Export ── */
  const exportExcel = () => {
    const dukunganLabel: Record<string, string> = {
      dukung: "Dukung",
      ragu_ragu: "Ragu",
      milih_sebelah: "Sebelah",
      terkonvert: "Convert",
    };
    const rows = filtered.map((t) => ({
      No: t.no || "",
      NOSIS: t.alumni_nosis || "",
      Nama: t.nama,
      Angkatan: t.angkatan,
      "No HP": t.no_hp || "",
      "Sudah Dikontak": t.sudah_dikontak || "",
      Dukungan: t.dukungan ? (dukunganLabel[t.dukungan] || t.dukungan) : "",
      "Masuk Grup WA": t.masuk_grup || "",
      "Form DPT": t.isi_form_dpt || "",
      "Web DPT": t.registrasi_website_dpt || "",
      "Status DPT": t.status_dpt || "",
      Vote: t.vote || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Target Alumni");
    XLSX.writeFile(wb, "target_alumni.xlsx");
  };

  if (roleLoading || initialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#0B27BC]" />
          <p className="text-sm text-muted-foreground">Memuat data target...</p>
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
              <Crosshair className="w-5 h-5 text-[#FE8DA1]" />
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-white">
                  Target Saya
                </h1>
                <p className="text-xs text-white/70">
                  {formatNum(stats.total)} alumni ·{" "}
                  {availableAngkatan.length > 0
                    ? `TN ${availableAngkatan.join(", ")}`
                    : "Belum ada angkatan"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDashboardMode(!dashboardMode)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  dashboardMode
                    ? "bg-[#FE8DA1] text-white hover:bg-[#e97e91]"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
                title={dashboardMode ? "Tutup Dashboard" : "Buka Dashboard"}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Dashboard</span>
              </button>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white/80 hover:text-white transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              </button>
              <button
                onClick={exportExcel}
                disabled={filtered.length === 0}
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
        <DeadlineBanner />

        {/* Dashboard Mode — metrics + priority + per-TN funnel */}
        {dashboardMode && (
          <div className="bg-gradient-to-br from-[#0B27BC]/5 to-[#FE8DA1]/10 rounded-xl border-2 border-[#FE8DA1]/30 p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#0B27BC]" />
              <h2 className="text-base font-bold text-foreground">Dashboard Target</h2>
              <span className="text-[10px] text-muted-foreground ml-auto">
                Klik Dashboard lagi untuk tutup
              </span>
            </div>

            {/* Peta Dukungan — 4 cards by dukungan status */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              {[
                {
                  label: "Pendukung Kita",
                  sub: "Dukung / terkonvert",
                  value: stats.dukung,
                  icon: ShieldCheck,
                  color: "text-emerald-700",
                  bg: "bg-emerald-50",
                  border: "border-emerald-200",
                },
                {
                  label: "Masih Ragu",
                  sub: "Bisa diyakinkan",
                  value: stats.ragu,
                  icon: HelpCircle,
                  color: "text-yellow-700",
                  bg: "bg-yellow-50",
                  border: "border-yellow-200",
                },
                {
                  label: "Pilih Lawan",
                  sub: "Sdh pilih sebelah",
                  value: stats.sebelah,
                  icon: AlertOctagon,
                  color: "text-red-600",
                  bg: "bg-red-50",
                  border: "border-red-200",
                },
                {
                  label: "Belum Ditanya",
                  sub: "Belum ada info dukungan",
                  value: stats.belumTahu,
                  icon: TargetIcon,
                  color: "text-[#0B27BC]",
                  bg: "bg-[#0B27BC]/10",
                  border: "border-[#0B27BC]/30",
                },
              ].map((c) => {
                const Icon = c.icon;
                const pct = stats.total > 0 ? Math.round((c.value / stats.total) * 100) : 0;
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
                    <p className={`text-[10px] font-semibold ${c.color}`}>{pct}% target</p>
                    <p className="text-[9px] text-muted-foreground mt-0.5 leading-tight">{c.sub}</p>
                  </div>
                );
              })}
            </div>

            {/* Reminder Vote strip — pendukung yg sdh vote vs perlu diingatkan */}
            <div className="bg-white rounded-xl border border-border p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Reminder Vote (dari pendukung)
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5">
                  <p className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wide">Sudah Vote</p>
                  <p className="text-xl font-bold text-emerald-700 tabular-nums leading-tight">{formatNum(stats.suaraAman)}</p>
                  <p className="text-[9px] text-emerald-700/80">
                    {stats.dukung > 0 ? Math.round((stats.suaraAman / stats.dukung) * 100) : 0}% pendukung
                  </p>
                </div>
                <div className="rounded-lg border border-[#FE8DA1]/40 bg-[#FE8DA1]/15 p-2.5">
                  <p className="text-[10px] font-semibold text-[#84303F] uppercase tracking-wide">Perlu Diingatkan</p>
                  <p className="text-xl font-bold text-[#84303F] tabular-nums leading-tight">{formatNum(stats.suaraHarusDikejar)}</p>
                  <p className="text-[9px] text-[#84303F]/80">Pendukung blm vote — kejar hari-H</p>
                </div>
              </div>
            </div>

            {/* Konversi per tahap */}
            <div className="bg-white rounded-xl border border-border p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Konversi Per Tahap
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {[
                  { label: "Target→Kontak", value: stats.kontak, base: stats.total },
                  { label: "Kontak→Form", value: stats.formDpt, base: stats.kontak },
                  { label: "Form→Web", value: stats.webDpt, base: stats.formDpt },
                  { label: "Web→DPT", value: stats.dpt, base: stats.webDpt },
                  { label: "DPT→Vote", value: stats.vote, base: stats.dpt },
                ].map((s) => {
                  const pct = s.base > 0 ? Math.round((s.value / s.base) * 100) : 0;
                  const tone = pct >= 70 ? "text-emerald-600" : pct >= 40 ? "text-yellow-600" : "text-red-500";
                  return (
                    <div key={s.label} className="text-center bg-gray-50 rounded-lg p-2 border border-border">
                      <p className={`text-lg font-bold ${tone} tabular-nums leading-tight`}>{pct}%</p>
                      <p className="text-[9px] text-muted-foreground leading-tight">{s.label}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tier Pendukung — DPT registration urgency */}
            <TierPendukungCard
              tiers={stats.tiersPendukung}
              pendukungTotal={stats.dukung}
              subtitle="Tier registrasi DPT per pendukung — yang belum selesai tahap = beresiko hilang suara."
            />

            {/* Per-TN funnel + Top priority */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {/* Per-angkatan mini-bars — only show if > 1 TN */}
              {stats.perAngkatan.length > 1 && (
                <div className="bg-white rounded-xl border border-border p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Per Angkatan
                  </p>
                  <div className="space-y-1.5">
                    {stats.perAngkatan.map((a) => {
                      const base = a.total || 1;
                      const bocor = a.total - a.vote;
                      const bocorPct = Math.round((bocor / base) * 100);
                      return (
                        <div key={a.angkatan} className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-[#0B27BC] w-10 tabular-nums">
                            TN{a.angkatan}
                          </span>
                          <div className="flex-1 h-4 rounded-full bg-gray-100 overflow-hidden flex">
                            {(() => {
                              const pctVote = (a.vote / base) * 100;
                              const pctDpt = ((a.dpt - a.vote) / base) * 100;
                              const pctWeb = ((a.webDpt - a.dpt) / base) * 100;
                              const pctForm = ((a.formDpt - a.webDpt) / base) * 100;
                              const pctKontak = ((a.kontak - a.formDpt) / base) * 100;
                              return [
                                { w: pctVote, c: "#84303F" },
                                { w: pctDpt, c: "#f97316" },
                                { w: pctWeb, c: "#eab308" },
                                { w: pctForm, c: "#10b981" },
                                { w: pctKontak, c: "#3b82f6" },
                              ].map((seg, i) => seg.w > 0 ? (
                                <div
                                  key={i}
                                  className="h-full"
                                  style={{ width: `${Math.max(0, seg.w)}%`, backgroundColor: seg.c }}
                                />
                              ) : null);
                            })()}
                          </div>
                          <span className="text-[10px] font-semibold text-red-500 w-16 text-right tabular-nums">
                            −{formatNum(bocor)} ({bocorPct}%)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-border text-[9px]">
                    {[
                      { c: "#84303F", l: "Vote" },
                      { c: "#f97316", l: "DPT" },
                      { c: "#eab308", l: "Web" },
                      { c: "#10b981", l: "Form" },
                      { c: "#3b82f6", l: "Kontak" },
                    ].map((s) => (
                      <span key={s.l} className="flex items-center gap-1 text-muted-foreground">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.c }} />
                        {s.l}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Top 5 prioritas */}
              <div className={`bg-white rounded-xl border border-border p-3 ${stats.perAngkatan.length > 1 ? "" : "lg:col-span-2"}`}>
                <div className="flex items-center gap-1.5 mb-2">
                  <Flame className="w-3.5 h-3.5 text-[#84303F]" />
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Top 5 Prioritas
                  </p>
                </div>
                {topPriority.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    Semua sudah lengkap 🎉
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {topPriority.map(({ row, action }, idx) => (
                      <div
                        key={row.alumni_id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-gray-50 border border-border"
                      >
                        <span className="text-[10px] font-bold text-gray-400 tabular-nums w-4">
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{row.nama}</p>
                          <p className="text-[9px] text-muted-foreground">
                            TN{row.angkatan} · {row.no_hp || "belum ada HP"}
                          </p>
                        </div>
                        <span className={`text-[10px] font-bold whitespace-nowrap ${action.color}`}>
                          {action.label}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Coverage footer */}
            <div className="bg-white rounded-xl border border-border p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Cakupan Data Target
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <div>
                  <p className="text-lg font-bold text-[#0B27BC] tabular-nums">
                    {formatNum(stats.withHP)}
                    <span className="text-gray-300 text-xs font-normal">/{formatNum(stats.total)}</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground">Punya No HP</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-emerald-600 tabular-nums">
                    {formatNum(stats.dukung)}
                    <span className="text-gray-300 text-xs font-normal">/{formatNum(stats.total)}</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground">Pendukung Kita</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-yellow-600 tabular-nums">
                    {formatNum(stats.belumTahu)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Belum Ditanya</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-[#84303F] tabular-nums">
                    {formatNum(stats.grup)}
                    <span className="text-gray-300 text-xs font-normal">/{formatNum(stats.total)}</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground">Di Grup WA</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Funnel strip — 6 stages */}
        <div className="bg-white rounded-xl border border-border p-3 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">
            Funnel DPT → Vote
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
            {[
              { label: "Target", value: stats.total, icon: Crosshair, color: "text-[#0B27BC]", bg: "bg-[#0B27BC]/10", denom: null },
              { label: "Kontak", value: stats.kontak, icon: MessageCircle, color: "text-[#0B27BC]", bg: "bg-[#0B27BC]/10", denom: stats.total },
              { label: "Form DPT", value: stats.formDpt, icon: ClipboardCheck, color: "text-emerald-700", bg: "bg-emerald-50", denom: stats.total },
              { label: "Web DPT", value: stats.webDpt, icon: Smartphone, color: "text-yellow-700", bg: "bg-yellow-50", denom: stats.total },
              { label: "DPT", value: stats.dpt, icon: ClipboardCheck, color: "text-orange-700", bg: "bg-orange-50", denom: stats.total },
              { label: "Vote", value: stats.vote, icon: VoteIcon, color: "text-[#84303F]", bg: "bg-[#84303F]/10", denom: stats.total },
            ].map((s, i) => (
              <div
                key={s.label}
                className="bg-white rounded-lg border border-border p-2 text-center relative"
              >
                <div className={`inline-flex p-1 rounded-lg ${s.bg} mb-0.5`}>
                  <s.icon className={`w-3 h-3 ${s.color}`} />
                </div>
                <p className="text-base font-bold text-foreground leading-tight">
                  {formatNum(s.value)}
                </p>
                <p className="text-[9px] text-muted-foreground leading-tight">{s.label}</p>
                {s.denom !== null && s.denom > 0 && (
                  <p className={`text-[9px] font-semibold ${s.color} leading-tight`}>
                    {Math.round((s.value / s.denom) * 100)}%
                  </p>
                )}
                {i > 0 && i < 6 && (
                  <ArrowRight className="hidden sm:block absolute -left-[9px] top-1/2 -translate-y-1/2 w-3 h-3 text-gray-300 z-10 bg-background rounded-full" />
                )}
              </div>
            ))}
          </div>
          <div className="mt-2 pt-2 border-t border-border/50 px-1 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-muted-foreground">Dukungan:</span>
              <span className="text-[11px] font-semibold text-emerald-600 tabular-nums flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {formatNum(stats.dukung)} Dukung
              </span>
              <span className="text-[11px] font-semibold text-yellow-600 tabular-nums flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                {formatNum(stats.ragu)} Ragu
              </span>
              <span className="text-[11px] font-semibold text-red-600 tabular-nums flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                {formatNum(stats.sebelah)} Sebelah
              </span>
              <span className="text-[11px] font-semibold text-gray-500 tabular-nums flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                {formatNum(stats.belumTahu)} Blm di-approach
              </span>
              <span className="text-[11px] font-semibold text-[#84303F] tabular-nums ml-auto">
                <UsersIcon className="inline w-3 h-3 mr-0.5" />
                {formatNum(stats.grup)} Grup WA
              </span>
            </div>
          </div>
        </div>

        {/* Next-action preset chips */}
        <div className="bg-white rounded-xl border border-border p-3 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <ArrowRight className="w-4 h-4 text-[#0B27BC]" />
              <h3 className="text-sm font-semibold text-foreground">Tindak Lanjut</h3>
            </div>
            <label className="inline-flex items-center gap-1.5 text-[10px] font-medium text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={sortByPriority}
                onChange={(e) => setSortByPriority(e.target.checked)}
                className="rounded border-gray-300 text-[#0B27BC] focus:ring-[#0B27BC]/30"
              />
              Urutkan Prioritas
            </label>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_DEFS.map((p) => {
              const count = stats.presetCounts[p.key];
              const isActive = activePreset === p.key;
              return (
                <button
                  key={p.key}
                  onClick={() => setActivePreset(p.key)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-full border transition-all ${
                    isActive
                      ? "bg-[#0B27BC] text-white border-[#0B27BC] shadow-sm"
                      : p.color + " hover:opacity-80"
                  }`}
                >
                  <span>{p.label}</span>
                  <span className={`tabular-nums font-bold px-1.5 rounded-full text-[10px] ${
                    isActive ? "bg-white/20 text-white" : "bg-white"
                  }`}>
                    {formatNum(count)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-4 py-3 space-y-2">
            {/* Search + angkatan + filter toggle */}
            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-[150px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Cari nama / HP..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC]"
                />
              </div>
              {availableAngkatan.length > 1 && (
                <select
                  value={filterAngkatan}
                  onChange={(e) => setFilterAngkatan(e.target.value)}
                  className="px-3 py-2 text-sm border border-border rounded-lg bg-white"
                >
                  <option value="all">Semua TN</option>
                  {availableAngkatan.map((a) => (
                    <option key={a} value={a}>
                      TN {a}
                    </option>
                  ))}
                </select>
              )}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg transition-colors ${
                  activeFilterCount > 0
                    ? "bg-[#0B27BC] text-white border-[#0B27BC]"
                    : "bg-white text-gray-600 border-border hover:bg-gray-50"
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                Filter
                {activeFilterCount > 0 && (
                  <span className="bg-white text-[#0B27BC] text-[10px] font-bold rounded-full w-4 h-4 inline-flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>

            {/* Advanced per-column filters */}
            {showFilters && (
              <div className="pt-2 border-t border-border space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-gray-500">Filter per kolom</p>
                  {activeFilterCount > 0 && (
                    <button
                      onClick={resetFilters}
                      className="text-[10px] text-red-500 hover:text-red-700 inline-flex items-center gap-1"
                    >
                      <X className="w-3 h-3" />
                      Reset
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                  {/* No HP */}
                  <div>
                    <label className="text-[10px] text-gray-400 mb-0.5 block">No HP</label>
                    <select
                      value={fPhone}
                      onChange={(e) => setFPhone(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-border rounded-lg bg-white"
                    >
                      <option value="all">Semua</option>
                      <option value="has">Ada</option>
                      <option value="empty">Kosong</option>
                    </select>
                  </div>
                  {/* Kontak */}
                  <div>
                    <label className="text-[10px] text-gray-400 mb-0.5 block">Kontak</label>
                    <select
                      value={fKontak}
                      onChange={(e) => setFKontak(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-border rounded-lg bg-white"
                    >
                      <option value="all">Semua</option>
                      <option value="Sudah">Sudah</option>
                      <option value="Belum">Belum</option>
                    </select>
                  </div>
                  {/* Dukungan */}
                  <div>
                    <label className="text-[10px] text-gray-400 mb-0.5 block">Dukungan</label>
                    <select
                      value={fDukungan}
                      onChange={(e) => setFDukungan(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-border rounded-lg bg-white"
                    >
                      <option value="all">Semua</option>
                      <option value="pendukung">Pendukung (Dukung + Convert)</option>
                      <option value="dukung">Dukung</option>
                      <option value="ragu_ragu">Ragu-ragu</option>
                      <option value="milih_sebelah">Milih Sebelah</option>
                      <option value="terkonvert">Terkonvert</option>
                      <option value="empty">Belum diisi</option>
                    </select>
                  </div>
                  {/* Grup */}
                  <div>
                    <label className="text-[10px] text-gray-400 mb-0.5 block">Grup WA</label>
                    <select
                      value={fGrup}
                      onChange={(e) => setFGrup(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-border rounded-lg bg-white"
                    >
                      <option value="all">Semua</option>
                      <option value="Sudah">Sudah</option>
                      <option value="Belum">Belum</option>
                    </select>
                  </div>
                  {/* Form DPT */}
                  <div>
                    <label className="text-[10px] text-gray-400 mb-0.5 block">Form DPT</label>
                    <select
                      value={fFormDpt}
                      onChange={(e) => setFFormDpt(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-border rounded-lg bg-white"
                    >
                      <option value="all">Semua</option>
                      <option value="Sudah">Sudah</option>
                      <option value="Belum">Belum</option>
                    </select>
                  </div>
                  {/* Web DPT */}
                  <div>
                    <label className="text-[10px] text-gray-400 mb-0.5 block">Web DPT</label>
                    <select
                      value={fWebDpt}
                      onChange={(e) => setFWebDpt(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-border rounded-lg bg-white"
                    >
                      <option value="all">Semua</option>
                      <option value="Sudah">Sudah</option>
                      <option value="Belum">Belum</option>
                    </select>
                  </div>
                  {/* DPT */}
                  <div>
                    <label className="text-[10px] text-gray-400 mb-0.5 block">DPT</label>
                    <select
                      value={fDpt}
                      onChange={(e) => setFDpt(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-border rounded-lg bg-white"
                    >
                      <option value="all">Semua</option>
                      <option value="Sudah">Sudah</option>
                      <option value="Belum">Belum</option>
                    </select>
                  </div>
                  {/* Vote */}
                  <div>
                    <label className="text-[10px] text-gray-400 mb-0.5 block">Vote</label>
                    <select
                      value={fVote}
                      onChange={(e) => setFVote(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-border rounded-lg bg-white"
                    >
                      <option value="all">Semua</option>
                      <option value="Sudah">Sudah</option>
                      <option value="Belum">Belum</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Target Table */}
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border bg-gray-50/80 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">
              Daftar Target ({formatNum(totalFiltered)})
            </h3>
            {totalPages > 1 && (
              <span className="text-[10px] text-muted-foreground">
                Hal {safePage}/{totalPages}
              </span>
            )}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-gray-50/50">
                  <th className="text-left px-3 py-2 font-semibold text-gray-500 text-xs w-10">
                    #
                  </th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-500 text-xs">
                    Nama
                  </th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-500 text-xs w-[120px]">
                    <Phone className="w-3 h-3 inline mr-1" />
                    No HP
                  </th>
                  <th className="text-left px-2 py-2 font-semibold text-gray-500 text-xs w-[140px]">
                    <ArrowRight className="w-3 h-3 inline mr-0.5" />
                    Aksi Berikutnya
                  </th>
                  <th className="text-center px-2 py-2 font-semibold text-gray-500 text-xs">
                    <CalendarCheck className="w-3 h-3 inline mr-0.5" />
                    Event
                  </th>
                  <th className="text-center px-2 py-2 font-semibold text-gray-500 text-xs">
                    Kontak
                  </th>
                  <th className="text-center px-2 py-2 font-semibold text-gray-500 text-xs">
                    Dukungan
                  </th>
                  <th className="text-center px-2 py-2 font-semibold text-gray-500 text-xs">
                    Grup
                  </th>
                  <th className="text-center px-2 py-2 font-semibold text-gray-500 text-xs">
                    Form DPT
                  </th>
                  <th className="text-center px-2 py-2 font-semibold text-gray-500 text-xs">
                    Web DPT
                  </th>
                  <th className="text-center px-2 py-2 font-semibold text-gray-500 text-xs">
                    DPT
                  </th>
                  <th className="text-center px-2 py-2 font-semibold text-gray-500 text-xs">
                    Vote
                  </th>
                </tr>
              </thead>
              <tbody>
                {targets.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Crosshair className="w-8 h-8 text-gray-200" />
                        <p className="text-sm text-muted-foreground">
                          {debouncedSearch || activeFilterCount > 0
                            ? "Tidak ada data yang cocok"
                            : "Belum ada target. Minta admin mengatur angkatan Anda."}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  targets.map((row, idx) => (
                    <tr
                      key={row.alumni_id}
                      className="border-b border-border last:border-b-0 hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-3 py-2 text-gray-400 text-xs">
                        {(safePage - 1) * PAGE_SIZE + idx + 1}
                      </td>
                      <td className="px-3 py-2">
                        <div>
                          <p className="text-sm font-medium text-foreground truncate max-w-[200px]">
                            {row.nama}
                          </p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-[10px] text-muted-foreground">
                              TN {row.angkatan}
                              {row.alumni_kelanjutan_studi
                                ? ` · ${row.alumni_kelanjutan_studi}`
                                : ""}
                            </p>
                            <ProgressDots row={row} />
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <InlinePhoneEdit
                            value={row.no_hp}
                            onSave={(v) => handleFieldUpdate(row, "no_hp", v)}
                          />
                          {row.no_hp && (
                            <a
                              href={`https://wa.me/${row.no_hp}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Buka WhatsApp"
                              className="shrink-0 p-1 rounded-full hover:bg-emerald-50 text-emerald-500 hover:text-emerald-600 transition-colors"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        {(() => {
                          const action = computeNextAction(row);
                          return (
                            <span className={`text-[11px] font-semibold whitespace-nowrap ${action.color}`}>
                              {action.label}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-2 py-2 text-center">
                        <span className={`text-xs font-semibold ${row.attendance_count > 0 ? "text-[#0B27BC]" : "text-gray-300"}`}>
                          {row.attendance_count}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <StatusChip
                          value={row.sudah_dikontak}
                          onClick={row.masuk_grup !== "Sudah" ? () => toggleBinary(row, "sudah_dikontak") : undefined}
                          readOnly={row.masuk_grup === "Sudah"}
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <DukunganSelect
                          value={row.dukungan}
                          onChange={(v) => handleFieldUpdate(row, "dukungan", v)}
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <StatusChip
                          value={row.masuk_grup}
                          readOnly
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <StatusChip
                          value={row.isi_form_dpt}
                          onClick={isCampaigner ? undefined : () => toggleBinary(row, "isi_form_dpt")}
                          readOnly={isCampaigner}
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <StatusChip
                          value={row.registrasi_website_dpt}
                          onClick={() => toggleBinary(row, "registrasi_website_dpt")}
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <StatusChip
                          value={row.status_dpt}
                          onClick={() => toggleBinary(row, "status_dpt")}
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <StatusChip
                          value={row.vote}
                          onClick={() => toggleBinary(row, "vote")}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-border">
            {targets.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <Crosshair className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {debouncedSearch || activeFilterCount > 0
                    ? "Tidak ada data yang cocok"
                    : "Belum ada target. Minta admin mengatur angkatan Anda."}
                </p>
              </div>
            ) : (
              targets.map((row) => {
                const action = computeNextAction(row);
                return (
                <div key={row.alumni_id} className="px-4 py-3 space-y-2">
                  {/* Name + angkatan */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {row.nama}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[10px] text-muted-foreground">
                          TN {row.angkatan}
                          {row.alumni_kelanjutan_studi
                            ? ` · ${row.alumni_kelanjutan_studi}`
                            : ""}
                        </p>
                        <ProgressDots row={row} />
                      </div>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#0B27BC]/10 text-[#0B27BC] font-medium shrink-0">
                      TN{row.angkatan}
                    </span>
                  </div>

                  {/* Next Action banner */}
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-gray-50 border border-border">
                    <ArrowRight className="w-3 h-3 text-gray-400 shrink-0" />
                    <span className="text-[9px] text-gray-400 uppercase tracking-wider">Aksi</span>
                    <span className={`text-[11px] font-semibold ${action.color}`}>
                      {action.label}
                    </span>
                  </div>

                  {/* Phone */}
                  <div className="flex items-center gap-2">
                    <Phone className="w-3 h-3 text-gray-400 shrink-0" />
                    <InlinePhoneEdit
                      value={row.no_hp}
                      onSave={(v) => handleFieldUpdate(row, "no_hp", v)}
                    />
                    {row.no_hp && (
                      <a
                        href={`https://wa.me/${row.no_hp}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Buka WhatsApp"
                        className="shrink-0 p-1 rounded-full hover:bg-emerald-50 text-emerald-500 hover:text-emerald-600 transition-colors"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>

                  {/* Status chips grid */}
                  <div className="flex flex-wrap gap-1.5">
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] text-gray-400 w-8">Event</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${row.attendance_count > 0 ? "bg-[#0B27BC]/10 text-[#0B27BC]" : "bg-gray-50 text-gray-300"}`}>
                        {row.attendance_count}×
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] text-gray-400 w-10">Kontak</span>
                      <StatusChip
                        value={row.sudah_dikontak}
                        onClick={row.masuk_grup !== "Sudah" ? () => toggleBinary(row, "sudah_dikontak") : undefined}
                        readOnly={row.masuk_grup === "Sudah"}
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] text-gray-400 w-12">Dukung</span>
                      <DukunganSelect
                        value={row.dukungan}
                        onChange={(v) => handleFieldUpdate(row, "dukungan", v)}
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] text-gray-400 w-7">Grup</span>
                      <StatusChip
                        value={row.masuk_grup}
                        readOnly
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] text-gray-400 w-10">Form</span>
                      <StatusChip
                        value={row.isi_form_dpt}
                        onClick={isCampaigner ? undefined : () => toggleBinary(row, "isi_form_dpt")}
                        readOnly={isCampaigner}
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] text-gray-400 w-7">Web</span>
                      <StatusChip
                        value={row.registrasi_website_dpt}
                        onClick={isCampaigner ? undefined : () => toggleBinary(row, "registrasi_website_dpt")}
                        readOnly={isCampaigner}
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] text-gray-400 w-6">DPT</span>
                      <StatusChip
                        value={row.status_dpt}
                        onClick={isCampaigner ? undefined : () => toggleBinary(row, "status_dpt")}
                        readOnly={isCampaigner}
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] text-gray-400 w-7">Vote</span>
                      <StatusChip
                        value={row.vote}
                        onClick={isCampaigner ? undefined : () => toggleBinary(row, "vote")}
                        readOnly={isCampaigner}
                      />
                    </div>
                  </div>
                </div>
                );
              })
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-2.5 border-t border-border bg-gray-50/50 flex items-center justify-between">
              <button
                onClick={() => goPage(safePage - 1)}
                disabled={safePage <= 1}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-border rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Prev
              </button>
              <span className="text-xs text-muted-foreground">
                Hal <span className="font-semibold text-foreground">{safePage}</span> dari{" "}
                <span className="font-semibold text-foreground">{totalPages}</span>
                <span className="text-gray-400 ml-1">({formatNum(totalFiltered)} target)</span>
              </span>
              <button
                onClick={() => goPage(safePage + 1)}
                disabled={safePage >= totalPages}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-border rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
