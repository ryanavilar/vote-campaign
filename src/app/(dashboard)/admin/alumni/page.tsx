"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRole } from "@/lib/RoleContext";
import { useToast } from "@/components/Toast";
import { formatNum } from "@/lib/format";
import type { StatusValue } from "@/lib/types";
import {
  Loader2,
  GraduationCap,
  Search,
  AlertTriangle,
  Link2,
  Check,
  X,
  Phone,
  User,
  CheckCircle2,
  HelpCircle,
  Unlink,
  RefreshCw,
  Filter,
  CalendarCheck,
  ThumbsUp,
  ArrowLeftRight,
  Users as UsersIcon,
  MessageCircle,
} from "lucide-react";

/* ── Types ─────────────────────────────────────────────── */

interface MemberInfo {
  id: string;
  no: number;
  no_hp?: string | null;
  pic?: string | null;
  status_dpt?: string | null;
  sudah_dikontak?: string | null;
  masuk_grup?: string | null;
  vote?: string | null;
  dukungan?: string | null;
  attendance_count?: number;
}

interface AlumniRow {
  id: string;
  nama: string;
  angkatan: number;
  nosis: string | null;
  kelanjutan_studi: string | null;
  program_studi: string | null;
  keterangan: string | null;
  members: MemberInfo[] | null;
}

interface MatchCandidate {
  member_id: string;
  member_nama: string;
  member_angkatan: number;
  alumni_id: string;
  alumni_nama: string;
  alumni_angkatan: number;
  confidence: "certain" | "uncertain";
  similarity: number;
}

interface PreviewResult {
  candidates: MatchCandidate[];
  total_unlinked: number;
  total_certain: number;
  total_uncertain: number;
  total_no_match: number;
}

type LinkTab = "certain" | "uncertain";

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
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  const save = () => {
    const digitsOnly = draft.replace(/\D/g, "");
    if (digitsOnly !== value) onSave(digitsOnly);
    setDraft(digitsOnly);
    setEditing(false);
  };

  if (!editing) {
    return (
      <button
        onClick={() => { setDraft(value); setEditing(true); }}
        className="text-xs text-left w-full px-2 py-1 rounded hover:bg-gray-100 transition-colors min-w-[90px] truncate"
      >
        {value || <span className="text-gray-300 italic">+ No HP</span>}
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
        onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") { setDraft(value); setEditing(false); }
        }}
        className="text-xs w-full px-2 py-1 border border-[#0B27BC] rounded focus:outline-none focus:ring-1 focus:ring-[#0B27BC]/30"
        placeholder="628xxxxxxxxxx"
      />
      <p className="text-[9px] text-[#0B27BC]/70 mt-0.5 px-1">
        628xxx (bukan 08xxx)
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
      <span className={`text-[10px] px-2 py-1 rounded-full font-medium whitespace-nowrap inline-block ${isSudah ? "bg-emerald-100/60 text-emerald-600" : "bg-gray-50 text-gray-300"}`}>
        {isSudah ? "Sudah" : "Belum"}
      </span>
    );
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`text-[10px] px-2 py-1 rounded-full font-medium transition-all whitespace-nowrap cursor-pointer border ${isSudah ? "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200 hover:border-emerald-300" : "bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200 hover:border-gray-300"} active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed`}
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

/* ── Main Page ─────────────────────────────────────────── */

export default function AdminAlumniPage() {
  const { canManageUsers, loading: roleLoading } = useRole();
  const { showToast } = useToast();

  const [alumni, setAlumni] = useState<AlumniRow[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAngkatan, setFilterAngkatan] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [fKontak, setFKontak] = useState("all");
  const [fDukungan, setFDukungan] = useState("all");
  const [fGrup, setFGrup] = useState("all");
  const [fDpt, setFDpt] = useState("all");
  const [fVote, setFVote] = useState("all");
  const [fPhone, setFPhone] = useState("all");
  const [fLinked, setFLinked] = useState("all");

  const activeFilterCount = [fKontak, fDukungan, fGrup, fDpt, fVote, fPhone].filter((f) => f !== "all").length;

  const resetFilters = () => {
    setFKontak("all"); setFDukungan("all"); setFGrup("all");
    setFDpt("all"); setFVote("all"); setFPhone("all");
  };

  // Auto-link modal state
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkConfirming, setLinkConfirming] = useState(false);
  const [linkPreview, setLinkPreview] = useState<PreviewResult | null>(null);
  const [linkTab, setLinkTab] = useState<LinkTab>("certain");
  const [selectedPairs, setSelectedPairs] = useState<Set<string>>(new Set());

  // Fetch all data at once (like Target page)
  const fetchAlumni = useCallback(async () => {
    setLoadingData(true);
    try {
      const res = await fetch("/api/alumni?all=true");
      if (res.ok) {
        const data = await res.json();
        setAlumni(data.data || []);
      } else {
        showToast("Gagal memuat data alumni", "error");
      }
    } catch {
      showToast("Gagal memuat data alumni", "error");
    }
    setLoadingData(false);
  }, [showToast]);

  useEffect(() => {
    if (roleLoading) return;
    if (canManageUsers) fetchAlumni();
    else setLoadingData(false);
  }, [fetchAlumni, roleLoading, canManageUsers]);

  // Available angkatan from data
  const availableAngkatan = useMemo(() => {
    const set = new Set<number>();
    alumni.forEach((a) => set.add(a.angkatan));
    return Array.from(set).sort((a, b) => a - b);
  }, [alumni]);

  // Stats from all data (terkonvert counts as pendukung)
  const stats = useMemo(() => {
    const total = alumni.length;
    const linked = alumni.filter((a) => a.members && a.members.length > 0);
    const kontak = linked.filter((a) => a.members![0].sudah_dikontak === "Sudah").length;
    const dukung = linked.filter((a) => {
      const d = a.members![0].dukungan;
      return d === "dukung" || d === "terkonvert";
    }).length;
    const ragu = linked.filter((a) => a.members![0].dukungan === "ragu_ragu").length;
    const sebelah = linked.filter((a) => a.members![0].dukungan === "milih_sebelah").length;
    const grup = linked.filter((a) => a.members![0].masuk_grup === "Sudah").length;
    return { total, linked: linked.length, kontak, dukung, ragu, sebelah, grup };
  }, [alumni]);

  // Filter all alumni client-side
  const filteredAlumni = useMemo(() => {
    return alumni.filter((item) => {
      const q = searchQuery.toLowerCase();
      const member = item.members && item.members.length > 0 ? item.members[0] : null;

      // Search
      if (q && !item.nama.toLowerCase().includes(q) && !(member?.no_hp && member.no_hp.includes(searchQuery))) return false;

      // Angkatan filter
      if (filterAngkatan !== "all" && item.angkatan !== Number(filterAngkatan)) return false;

      // Linked filter
      if (fLinked === "true" && !member) return false;
      if (fLinked === "false" && member) return false;

      // Per-column filters
      if (fPhone !== "all") {
        if (fPhone === "has" && !member?.no_hp) return false;
        if (fPhone === "empty" && member?.no_hp) return false;
      }
      if (fKontak !== "all") {
        const val = member?.sudah_dikontak || null;
        if (fKontak === "empty" && val !== null) return false;
        else if (fKontak !== "empty" && val !== fKontak) return false;
      }
      if (fDukungan !== "all") {
        const val = member?.dukungan || null;
        if (fDukungan === "pendukung" && val !== "dukung" && val !== "terkonvert") return false;
        else if (fDukungan === "empty" && val) return false;
        else if (fDukungan !== "pendukung" && fDukungan !== "empty" && val !== fDukungan) return false;
      }
      if (fGrup !== "all") {
        const val = member?.masuk_grup || "Belum";
        if (val !== fGrup) return false;
      }
      if (fDpt !== "all") {
        const val = member?.status_dpt || null;
        if (fDpt === "empty" && val !== null) return false;
        else if (fDpt !== "empty" && val !== fDpt) return false;
      }
      if (fVote !== "all") {
        const val = member?.vote || null;
        if (fVote === "empty" && val !== null) return false;
        else if (fVote !== "empty" && val !== fVote) return false;
      }

      return true;
    });
  }, [alumni, searchQuery, filterAngkatan, fLinked, fKontak, fDukungan, fGrup, fDpt, fVote, fPhone]);

  // Field update handler — same flow as Target: auto-create member on first edit
  const handleFieldUpdate = useCallback(
    async (item: AlumniRow, field: string, value: string | null) => {
      const member = item.members && item.members.length > 0 ? item.members[0] : null;

      // Optimistic update
      setAlumni((prev) =>
        prev.map((a) => {
          if (a.id !== item.id) return a;
          if (a.members && a.members.length > 0) {
            return { ...a, members: [{ ...a.members[0], [field]: value }] };
          }
          // Unlinked: create temporary member object for optimistic UI
          return { ...a, members: [{ id: "__temp__", no: 0, [field]: value } as MemberInfo] };
        })
      );

      if (member) {
        // Member exists — PATCH directly
        try {
          const res = await fetch(`/api/members/${member.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ [field]: value }),
          });
          if (!res.ok) {
            fetchAlumni();
            showToast("Gagal mengupdate", "error");
          }
        } catch {
          fetchAlumni();
          showToast("Gagal mengupdate", "error");
        }
      } else {
        // No member yet — POST to create + update (same as Target)
        try {
          const res = await fetch("/api/targets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ alumni_id: item.id, field, value }),
          });
          if (res.ok) {
            const data = await res.json();
            // Update state with real member data (like Target does)
            setAlumni((prev) =>
              prev.map((a) => {
                if (a.id !== item.id) return a;
                return {
                  ...a,
                  members: [{
                    id: data.member_id,
                    no: data.member?.no || 0,
                    no_hp: data.member?.no_hp || "",
                    status_dpt: data.member?.status_dpt ?? null,
                    sudah_dikontak: data.member?.sudah_dikontak ?? null,
                    masuk_grup: data.member?.masuk_grup ?? null,
                    vote: data.member?.vote ?? null,
                    dukungan: data.member?.dukungan ?? null,
                    attendance_count: 0,
                  }],
                };
              })
            );
          } else {
            fetchAlumni();
            showToast("Gagal membuat data anggota", "error");
          }
        } catch {
          fetchAlumni();
          showToast("Gagal membuat data anggota", "error");
        }
      }
    },
    [fetchAlumni, showToast]
  );

  const toggleBinary = (item: AlumniRow, field: string) => {
    const member = item.members && item.members.length > 0 ? item.members[0] : null;
    const current = (member?.[field as keyof MemberInfo] as StatusValue) || null;
    const next = current === "Sudah" ? "Belum" : "Sudah";
    handleFieldUpdate(item, field, next);
  };

  // Auto-link handlers
  const handleAutoLinkPreview = async () => {
    setShowLinkModal(true);
    setLinkLoading(true);
    setLinkPreview(null);
    setLinkTab("certain");
    setSelectedPairs(new Set());
    try {
      const res = await fetch("/api/alumni/link/preview");
      const data = await res.json();
      if (res.ok) {
        setLinkPreview(data);
        const certainIds = new Set<string>(
          (data.candidates as MatchCandidate[])
            .filter((c) => c.confidence === "certain")
            .map((c) => c.member_id)
        );
        setSelectedPairs(certainIds);
      } else {
        showToast(data.error || "Gagal memuat preview", "error");
        setShowLinkModal(false);
      }
    } catch {
      showToast("Terjadi kesalahan jaringan", "error");
      setShowLinkModal(false);
    }
    setLinkLoading(false);
  };

  const handleConfirmLink = async () => {
    if (!linkPreview || selectedPairs.size === 0) return;
    setLinkConfirming(true);
    const pairs = linkPreview.candidates
      .filter((c) => selectedPairs.has(c.member_id))
      .map((c) => ({ member_id: c.member_id, alumni_id: c.alumni_id }));
    try {
      const res = await fetch("/api/alumni/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pairs }),
      });
      const result = await res.json();
      if (res.ok) {
        showToast(`${result.linked} anggota berhasil dihubungkan`, "success");
        setShowLinkModal(false);
        fetchAlumni();
      } else {
        showToast(result.error || "Gagal menghubungkan", "error");
      }
    } catch {
      showToast("Terjadi kesalahan jaringan", "error");
    }
    setLinkConfirming(false);
  };

  const togglePair = (memberId: string) => {
    setSelectedPairs((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId); else next.add(memberId);
      return next;
    });
  };

  const toggleAllInTab = (tab: LinkTab) => {
    if (!linkPreview) return;
    const tabCandidates = linkPreview.candidates.filter((c) => c.confidence === tab);
    const allSelected = tabCandidates.every((c) => selectedPairs.has(c.member_id));
    setSelectedPairs((prev) => {
      const next = new Set(prev);
      for (const c of tabCandidates) {
        if (allSelected) next.delete(c.member_id); else next.add(c.member_id);
      }
      return next;
    });
  };


  if (roleLoading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#0B27BC]" />
          <p className="text-sm text-muted-foreground">Memuat data alumni...</p>
        </div>
      </div>
    );
  }

  if (!canManageUsers) {
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

  const certainCandidates = linkPreview?.candidates.filter((c) => c.confidence === "certain") || [];
  const uncertainCandidates = linkPreview?.candidates.filter((c) => c.confidence === "uncertain") || [];
  const currentTabCandidates = linkTab === "certain" ? certainCandidates : uncertainCandidates;

  return (
    <div className="bg-background min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0B27BC] text-white shadow-lg">
        <div className="px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <GraduationCap className="w-5 h-5 text-[#FE8DA1]" />
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-white">Database Alumni</h1>
                <p className="text-xs text-white/70">
                  {formatNum(stats.total)} alumni ·{" "}
                  {availableAngkatan.length > 0
                    ? `TN ${availableAngkatan[0]}–${availableAngkatan[availableAngkatan.length - 1]}`
                    : "Belum ada angkatan"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleAutoLinkPreview} disabled={showLinkModal} className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-[#84303F] rounded-lg hover:bg-[#6e2835] transition-colors disabled:opacity-50">
                <Link2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Auto-Link</span>
              </button>
              <button onClick={fetchAlumni} className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-[#0B27BC] bg-white rounded-lg hover:bg-gray-100 transition-colors">
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>
        </div>
        <div className="h-1 bg-gradient-to-r from-[#fcb7c3] via-[#FE8DA1] to-[#fcb7c3]" />
      </header>

      <div className="px-4 sm:px-6 py-6 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {[
            { label: "Total", value: stats.total, icon: GraduationCap, color: "text-[#0B27BC]", bg: "bg-[#0B27BC]/10" },
            { label: "Kontak", value: stats.kontak, icon: MessageCircle, color: "text-[#0B27BC]", bg: "bg-[#0B27BC]/10" },
            { label: "Dukung", value: stats.dukung, icon: ThumbsUp, color: "text-emerald-700", bg: "bg-emerald-50" },
            { label: "Ragu", value: stats.ragu, icon: HelpCircle, color: "text-yellow-700", bg: "bg-yellow-50" },
            { label: "Sebelah", value: stats.sebelah, icon: ArrowLeftRight, color: "text-red-700", bg: "bg-red-50" },
            { label: "Grup", value: stats.grup, icon: UsersIcon, color: "text-[#84303F]", bg: "bg-[#84303F]/10" },
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

        {/* Filters */}
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-4 py-3 space-y-2">
            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-[150px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
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
                    <option key={a} value={a}>TN {a}</option>
                  ))}
                </select>
              )}
              <select
                value={fLinked}
                onChange={(e) => setFLinked(e.target.value)}
                className="px-3 py-2 text-sm border border-border rounded-lg bg-white"
              >
                <option value="all">Semua Status</option>
                <option value="true">Terhubung</option>
                <option value="false">Belum Terhubung</option>
              </select>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg transition-colors ${activeFilterCount > 0 ? "bg-[#0B27BC] text-white border-[#0B27BC]" : "bg-white text-gray-600 border-border hover:bg-gray-50"}`}
              >
                <Filter className="w-3.5 h-3.5" />
                Filter
                {activeFilterCount > 0 && (
                  <span className="bg-white text-[#0B27BC] text-[10px] font-bold rounded-full w-4 h-4 inline-flex items-center justify-center">{activeFilterCount}</span>
                )}
              </button>
            </div>

            {showFilters && (
              <div className="pt-2 border-t border-border space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-gray-500">Filter per kolom</p>
                  {activeFilterCount > 0 && (
                    <button onClick={resetFilters} className="text-[10px] text-red-500 hover:text-red-700 inline-flex items-center gap-1">
                      <X className="w-3 h-3" />Reset
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-400 mb-0.5 block">No HP</label>
                    <select value={fPhone} onChange={(e) => setFPhone(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-border rounded-lg bg-white">
                      <option value="all">Semua</option><option value="has">Ada</option><option value="empty">Kosong</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 mb-0.5 block">Kontak</label>
                    <select value={fKontak} onChange={(e) => setFKontak(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-border rounded-lg bg-white">
                      <option value="all">Semua</option><option value="Sudah">Sudah</option><option value="Belum">Belum</option><option value="empty">Kosong</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 mb-0.5 block">Dukungan</label>
                    <select value={fDukungan} onChange={(e) => setFDukungan(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-border rounded-lg bg-white">
                      <option value="all">Semua</option><option value="pendukung">Pendukung (Dukung + Convert)</option><option value="dukung">Dukung</option><option value="ragu_ragu">Ragu-ragu</option><option value="milih_sebelah">Milih Sebelah</option><option value="terkonvert">Terkonvert</option><option value="empty">Belum diisi</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 mb-0.5 block">Grup WA</label>
                    <select value={fGrup} onChange={(e) => setFGrup(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-border rounded-lg bg-white">
                      <option value="all">Semua</option><option value="Sudah">Sudah</option><option value="Belum">Belum</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 mb-0.5 block">DPT</label>
                    <select value={fDpt} onChange={(e) => setFDpt(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-border rounded-lg bg-white">
                      <option value="all">Semua</option><option value="Sudah">Sudah</option><option value="Belum">Belum</option><option value="empty">Kosong</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 mb-0.5 block">Vote</label>
                    <select value={fVote} onChange={(e) => setFVote(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-border rounded-lg bg-white">
                      <option value="all">Semua</option><option value="Sudah">Sudah</option><option value="Belum">Belum</option><option value="empty">Kosong</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Alumni Table */}
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border bg-gray-50/80 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">
              Daftar Alumni ({formatNum(filteredAlumni.length)})
            </h3>
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-gray-50/50">
                  <th className="text-left px-3 py-2 font-semibold text-gray-500 text-xs w-10">#</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-500 text-xs">Nama</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-500 text-xs w-[120px]">
                    <Phone className="w-3 h-3 inline mr-1" />No HP
                  </th>
                  <th className="text-center px-2 py-2 font-semibold text-gray-500 text-xs">
                    <CalendarCheck className="w-3 h-3 inline mr-0.5" />Event
                  </th>
                  <th className="text-center px-2 py-2 font-semibold text-gray-500 text-xs">Kontak</th>
                  <th className="text-center px-2 py-2 font-semibold text-gray-500 text-xs">Dukungan</th>
                  <th className="text-center px-2 py-2 font-semibold text-gray-500 text-xs">Grup</th>
                  <th className="text-center px-2 py-2 font-semibold text-gray-500 text-xs">DPT</th>
                  <th className="text-center px-2 py-2 font-semibold text-gray-500 text-xs">Vote</th>
                </tr>
              </thead>
              <tbody>
                {filteredAlumni.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <GraduationCap className="w-8 h-8 text-gray-200" />
                        <p className="text-sm text-muted-foreground">
                          {searchQuery || filterAngkatan !== "all" || fLinked !== "all" || activeFilterCount > 0
                            ? "Tidak ada data yang cocok"
                            : "Belum ada data alumni."}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredAlumni.map((item, idx) => {
                    const member = item.members && item.members.length > 0 ? item.members[0] : null;
                    const isGrupSudah = member?.masuk_grup === "Sudah";

                    return (
                      <tr key={item.id} className="border-b border-border last:border-b-0 hover:bg-gray-50/50 transition-colors">
                        <td className="px-3 py-2 text-gray-400 text-xs">{idx + 1}</td>
                        <td className="px-3 py-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-medium text-foreground truncate max-w-[200px]">{item.nama}</p>
                              {item.keterangan?.includes("Almarhum") && (
                                <span className="text-[9px] font-semibold px-1 py-0.5 rounded bg-gray-100 text-gray-500 shrink-0">Almarhum</span>
                              )}
                            </div>
                            <p className="text-[10px] text-muted-foreground">
                              TN {item.angkatan}
                              {item.kelanjutan_studi ? ` · ${item.kelanjutan_studi}` : ""}
                            </p>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <InlinePhoneEdit value={member?.no_hp || ""} onSave={(v) => handleFieldUpdate(item, "no_hp", v)} />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <span className={`text-xs font-semibold ${(member?.attendance_count || 0) > 0 ? "text-[#0B27BC]" : "text-gray-300"}`}>
                            {member?.attendance_count || 0}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-center">
                          <StatusChip
                            value={(member?.sudah_dikontak as StatusValue) || null}
                            onClick={!isGrupSudah ? () => toggleBinary(item, "sudah_dikontak") : undefined}
                            readOnly={isGrupSudah}
                          />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <DukunganSelect value={member?.dukungan || null} onChange={(v) => handleFieldUpdate(item, "dukungan", v)} />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <StatusChip value={(member?.masuk_grup as StatusValue) || null} readOnly />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <StatusChip value={(member?.status_dpt as StatusValue) || null} onClick={() => toggleBinary(item, "status_dpt")} />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <StatusChip value={(member?.vote as StatusValue) || null} onClick={() => toggleBinary(item, "vote")} />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-border">
            {filteredAlumni.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <GraduationCap className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {searchQuery || filterAngkatan !== "all" || fLinked !== "all" || activeFilterCount > 0
                    ? "Tidak ada data yang cocok"
                    : "Belum ada data alumni."}
                </p>
              </div>
            ) : (
              filteredAlumni.map((item) => {
                const member = item.members && item.members.length > 0 ? item.members[0] : null;
                const isGrupSudah = member?.masuk_grup === "Sudah";

                return (
                  <div key={item.id} className="px-4 py-3 space-y-2">
                    {/* Name + angkatan */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium text-foreground truncate">{item.nama}</p>
                          {item.keterangan?.includes("Almarhum") && (
                            <span className="text-[9px] font-semibold px-1 py-0.5 rounded bg-gray-100 text-gray-500">Almarhum</span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          TN {item.angkatan}
                          {item.kelanjutan_studi ? ` · ${item.kelanjutan_studi}` : ""}
                        </p>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#0B27BC]/10 text-[#0B27BC] font-medium shrink-0">TN{item.angkatan}</span>
                    </div>

                    {/* Phone */}
                    <div className="flex items-center gap-2">
                      <Phone className="w-3 h-3 text-gray-400 shrink-0" />
                      <InlinePhoneEdit value={member?.no_hp || ""} onSave={(v) => handleFieldUpdate(item, "no_hp", v)} />
                    </div>

                    {/* Status chips grid */}
                    <div className="flex flex-wrap gap-1.5">
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-gray-400 w-8">Event</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${(member?.attendance_count || 0) > 0 ? "bg-[#0B27BC]/10 text-[#0B27BC]" : "bg-gray-50 text-gray-300"}`}>
                          {member?.attendance_count || 0}×
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-gray-400 w-10">Kontak</span>
                        <StatusChip
                          value={(member?.sudah_dikontak as StatusValue) || null}
                          onClick={!isGrupSudah ? () => toggleBinary(item, "sudah_dikontak") : undefined}
                          readOnly={isGrupSudah}
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-gray-400 w-12">Dukung</span>
                        <DukunganSelect value={member?.dukungan || null} onChange={(v) => handleFieldUpdate(item, "dukungan", v)} />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-gray-400 w-7">Grup</span>
                        <StatusChip value={(member?.masuk_grup as StatusValue) || null} readOnly />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-gray-400 w-6">DPT</span>
                        <StatusChip value={(member?.status_dpt as StatusValue) || null} onClick={() => toggleBinary(item, "status_dpt")} />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-gray-400 w-7">Vote</span>
                        <StatusChip value={(member?.vote as StatusValue) || null} onClick={() => toggleBinary(item, "vote")} />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Auto-Link Preview Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => !linkLoading && !linkConfirming && setShowLinkModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-border flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-[#0B27BC]" />Auto-Link Preview
                </h3>
                {linkPreview && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatNum(linkPreview.total_unlinked)} anggota belum terhubung
                    {linkPreview.total_no_match > 0 && <span className="ml-1">&middot; {formatNum(linkPreview.total_no_match)} tidak ditemukan kecocokan</span>}
                  </p>
                )}
              </div>
              <button onClick={() => setShowLinkModal(false)} disabled={linkConfirming} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {linkLoading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-[#0B27BC]" />
                <p className="text-sm text-muted-foreground">Menganalisis kecocokan nama...</p>
              </div>
            ) : linkPreview ? (
              <>
                <div className="flex border-b border-border shrink-0">
                  <button onClick={() => setLinkTab("certain")} className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${linkTab === "certain" ? "text-emerald-700 border-b-2 border-emerald-500 bg-emerald-50/50" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}>
                    <CheckCircle2 className="w-4 h-4" />Pasti ({formatNum(certainCandidates.length)})
                  </button>
                  <button onClick={() => setLinkTab("uncertain")} className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${linkTab === "uncertain" ? "text-amber-700 border-b-2 border-amber-500 bg-amber-50/50" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}>
                    <HelpCircle className="w-4 h-4" />Tidak Pasti ({formatNum(uncertainCandidates.length)})
                  </button>
                </div>

                {currentTabCandidates.length > 0 && (
                  <div className="px-5 py-2 border-b border-border flex items-center justify-between bg-gray-50/50 shrink-0">
                    <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                      <input type="checkbox" checked={currentTabCandidates.every((c) => selectedPairs.has(c.member_id))} onChange={() => toggleAllInTab(linkTab)} className="rounded border-gray-300 text-[#0B27BC] focus:ring-[#0B27BC]/20" />
                      Pilih semua {linkTab === "certain" ? "pasti" : "tidak pasti"}
                    </label>
                    <span className="text-xs text-muted-foreground">{currentTabCandidates.filter((c) => selectedPairs.has(c.member_id)).length} dipilih</span>
                  </div>
                )}

                <div className="flex-1 overflow-y-auto">
                  {currentTabCandidates.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-2">
                      <Unlink className="w-8 h-8 text-gray-300" />
                      <p className="text-sm text-muted-foreground">{linkTab === "certain" ? "Tidak ada kecocokan pasti" : "Tidak ada kecocokan tidak pasti"}</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3 px-5 py-2 bg-gray-100/80 border-b border-border text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                        <div className="w-4 shrink-0" />
                        <div className="flex-1 grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
                          <span className="flex items-center gap-1"><User className="w-3 h-3" /> Data Anggota</span>
                          <span />
                          <span className="flex items-center gap-1"><GraduationCap className="w-3 h-3" /> Data Alumni</span>
                        </div>
                      </div>
                      <div className="divide-y divide-border">
                        {currentTabCandidates.map((candidate) => {
                          const isSelected = selectedPairs.has(candidate.member_id);
                          return (
                            <label key={candidate.member_id} className={`flex items-center gap-3 px-5 py-3 cursor-pointer transition-colors ${isSelected ? "bg-blue-50/40" : "hover:bg-gray-50"}`}>
                              <input type="checkbox" checked={isSelected} onChange={() => togglePair(candidate.member_id)} className="rounded border-gray-300 text-[#0B27BC] focus:ring-[#0B27BC]/20 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
                                  <div className="min-w-0">
                                    <span className="text-sm font-medium text-foreground block truncate">{candidate.member_nama}</span>
                                    <span className="text-xs text-muted-foreground">TN{candidate.member_angkatan}</span>
                                  </div>
                                  <span className="text-xs text-gray-400">&rarr;</span>
                                  <div className="min-w-0">
                                    <span className="text-sm text-[#0B27BC] font-medium block truncate">{candidate.alumni_nama}</span>
                                    <span className="text-xs text-muted-foreground">TN{candidate.alumni_angkatan}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${candidate.similarity >= 85 ? "bg-emerald-100 text-emerald-700" : candidate.similarity >= 70 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                                    {candidate.similarity}% cocok
                                  </span>
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>

                <div className="px-5 py-3 border-t border-border flex items-center justify-between bg-gray-50/50 shrink-0">
                  <p className="text-xs text-muted-foreground">{formatNum(selectedPairs.size)} dari {formatNum(linkPreview.candidates.length)} dipilih</p>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setShowLinkModal(false)} disabled={linkConfirming} className="px-4 py-2 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Batal</button>
                    <button onClick={handleConfirmLink} disabled={selectedPairs.size === 0 || linkConfirming} className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#0B27BC] rounded-lg hover:bg-[#091fa0] transition-colors disabled:opacity-50">
                      {linkConfirming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                      Hubungkan ({formatNum(selectedPairs.size)})
                    </button>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
