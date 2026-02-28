"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRole } from "@/lib/RoleContext";
import { useToast } from "@/components/Toast";
import { formatNum } from "@/lib/format";
import type { StatusValue } from "@/lib/types";
import {
  Search,
  Loader2,
  Crosshair,
  Phone,
  MessageCircle,
  ThumbsUp,
  HelpCircle,
  ArrowLeftRight,
  Users as UsersIcon,
  ClipboardCheck,
  Vote,
  RefreshCw,
  Filter,
  X,
} from "lucide-react";

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
  sudah_dikontak: StatusValue;
  masuk_grup: StatusValue;
  vote: StatusValue;
  dukungan: string | null;
}

/* ── Dukungan config ───────────────────────────────────── */

const DUKUNGAN_LABELS: Record<string, string> = {
  dukung: "Dukung",
  ragu_ragu: "Ragu",
  milih_sebelah: "Sebelah",
  terkonvert: "Convert",
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

const DUKUNGAN_SELECT_STYLES: Record<string, string> = {
  dukung: "bg-emerald-100 text-emerald-700 border-emerald-200",
  ragu_ragu: "bg-yellow-100 text-yellow-700 border-yellow-200",
  milih_sebelah: "bg-red-100 text-red-700 border-red-200",
  terkonvert: "bg-blue-100 text-blue-700 border-blue-200",
};

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

export default function TargetPage() {
  const { canEdit: userCanEdit, loading: roleLoading } = useRole();
  const { showToast } = useToast();

  const [targets, setTargets] = useState<TargetRow[]>([]);
  const [loadingTargets, setLoadingTargets] = useState(true);
  const [updatingField, setUpdatingField] = useState<string | null>(null);

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

  const activeFilterCount = [fKontak, fDukungan, fGrup, fDpt, fVote, fPhone].filter((f) => f !== "all").length;

  const resetFilters = () => {
    setFKontak("all");
    setFDukungan("all");
    setFGrup("all");
    setFDpt("all");
    setFVote("all");
    setFPhone("all");
  };

  // Fetch targets
  const fetchTargets = useCallback(async () => {
    setLoadingTargets(true);
    try {
      const res = await fetch("/api/targets");
      if (res.ok) {
        const data = await res.json();
        setTargets(data);
      } else {
        showToast("Gagal memuat data target", "error");
      }
    } catch {
      showToast("Gagal memuat data target", "error");
    }
    setLoadingTargets(false);
  }, [showToast]);

  useEffect(() => {
    if (roleLoading) return;
    fetchTargets();
  }, [fetchTargets, roleLoading]);

  // Available angkatan from data
  const availableAngkatan = useMemo(() => {
    const set = new Set<number>();
    targets.forEach((t) => set.add(t.angkatan));
    return Array.from(set).sort((a, b) => a - b);
  }, [targets]);

  // Stats — terkonvert counts as pendukung
  const stats = useMemo(() => {
    const total = targets.length;
    const kontak = targets.filter((t) => t.sudah_dikontak === "Sudah").length;
    const dukung = targets.filter((t) => t.dukungan === "dukung" || t.dukungan === "terkonvert").length;
    const ragu = targets.filter((t) => t.dukungan === "ragu_ragu").length;
    const sebelah = targets.filter((t) => t.dukungan === "milih_sebelah").length;
    const grup = targets.filter((t) => t.masuk_grup === "Sudah").length;
    return { total, kontak, dukung, ragu, sebelah, grup };
  }, [targets]);

  // Filter targets — per-column
  const filteredTargets = useMemo(() => {
    return targets.filter((t) => {
      const q = searchQuery.toLowerCase();
      if (q && !t.nama.toLowerCase().includes(q) && !(t.no_hp && t.no_hp.includes(searchQuery))) return false;
      if (filterAngkatan !== "all" && t.angkatan !== Number(filterAngkatan)) return false;

      // Per-column filters
      if (fKontak !== "all") {
        if (fKontak === "empty") { if (t.sudah_dikontak !== null) return false; }
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
        if (fDpt === "empty") { if (t.status_dpt !== null) return false; }
        else if (t.status_dpt !== fDpt) return false;
      }
      if (fVote !== "all") {
        if (fVote === "empty") { if (t.vote !== null) return false; }
        else if (t.vote !== fVote) return false;
      }
      if (fPhone !== "all") {
        if (fPhone === "has" && !t.no_hp) return false;
        if (fPhone === "empty" && t.no_hp) return false;
      }

      return true;
    });
  }, [targets, searchQuery, filterAngkatan, fKontak, fDukungan, fGrup, fDpt, fVote, fPhone]);

  // Update handler
  const handleFieldUpdate = useCallback(
    async (row: TargetRow, field: string, value: string | null) => {
      const key = `${row.alumni_id}:${field}`;
      setUpdatingField(key);

      // Optimistic update
      setTargets((prev) =>
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
            fetchTargets();
            showToast("Gagal mengupdate", "error");
          }
        } catch {
          fetchTargets();
          showToast("Gagal mengupdate", "error");
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
            setTargets((prev) =>
              prev.map((t) =>
                t.alumni_id === row.alumni_id
                  ? {
                      ...t,
                      member_id: data.member_id,
                      no: data.member?.no || t.no,
                      no_hp: data.member?.no_hp || t.no_hp,
                      status_dpt: data.member?.status_dpt ?? t.status_dpt,
                      sudah_dikontak: data.member?.sudah_dikontak ?? t.sudah_dikontak,
                      // masuk_grup is derived from WA Group — keep existing value
                      vote: data.member?.vote ?? t.vote,
                      dukungan: data.member?.dukungan ?? t.dukungan,
                    }
                  : t
              )
            );
          } else {
            fetchTargets();
            showToast("Gagal membuat data anggota", "error");
          }
        } catch {
          fetchTargets();
          showToast("Gagal membuat data anggota", "error");
        }
      }

      setUpdatingField(null);
    },
    [fetchTargets, showToast]
  );

  // Toggle binary field
  const toggleBinary = (row: TargetRow, field: string) => {
    const current = row[field as keyof TargetRow] as StatusValue;
    const next = current === "Sudah" ? "Belum" : "Sudah";
    handleFieldUpdate(row, field, next);
  };

  if (roleLoading || loadingTargets) {
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
            <button
              onClick={fetchTargets}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-[#0B27BC] bg-white rounded-lg hover:bg-gray-100 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
        <div className="h-1 bg-gradient-to-r from-[#fcb7c3] via-[#FE8DA1] to-[#fcb7c3]" />
      </header>

      <div className="px-4 sm:px-6 py-6 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {[
            { label: "Total", value: stats.total, icon: Crosshair, color: "text-[#0B27BC]", bg: "bg-[#0B27BC]/10" },
            { label: "Kontak", value: stats.kontak, icon: MessageCircle, color: "text-[#0B27BC]", bg: "bg-[#0B27BC]/10" },
            { label: "Dukung", value: stats.dukung, icon: ThumbsUp, color: "text-emerald-700", bg: "bg-emerald-50" },
            { label: "Ragu", value: stats.ragu, icon: HelpCircle, color: "text-yellow-700", bg: "bg-yellow-50" },
            { label: "Sebelah", value: stats.sebelah, icon: ArrowLeftRight, color: "text-red-700", bg: "bg-red-50" },
            { label: "Grup", value: stats.grup, icon: UsersIcon, color: "text-[#84303F]", bg: "bg-[#84303F]/10" },
          ].map((s) => (
            <div
              key={s.label}
              className="bg-white rounded-xl border border-border p-2.5 shadow-sm text-center"
            >
              <div className={`inline-flex p-1 rounded-lg ${s.bg} mb-1`}>
                <s.icon className={`w-3.5 h-3.5 ${s.color}`} />
              </div>
              <p className="text-lg font-bold text-foreground leading-tight">
                {formatNum(s.value)}
              </p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
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
                      <option value="empty">Kosong</option>
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
                      <option value="empty">Kosong</option>
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
                      <option value="empty">Kosong</option>
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
              Daftar Target ({formatNum(filteredTargets.length)})
            </h3>
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
                    DPT
                  </th>
                  <th className="text-center px-2 py-2 font-semibold text-gray-500 text-xs">
                    Vote
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredTargets.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Crosshair className="w-8 h-8 text-gray-200" />
                        <p className="text-sm text-muted-foreground">
                          {searchQuery || activeFilterCount > 0
                            ? "Tidak ada data yang cocok"
                            : "Belum ada target. Minta admin mengatur angkatan Anda."}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredTargets.map((row, idx) => (
                    <tr
                      key={row.alumni_id}
                      className="border-b border-border last:border-b-0 hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-3 py-2 text-gray-400 text-xs">
                        {idx + 1}
                      </td>
                      <td className="px-3 py-2">
                        <div>
                          <p className="text-sm font-medium text-foreground truncate max-w-[200px]">
                            {row.nama}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            TN {row.angkatan}
                            {row.alumni_kelanjutan_studi
                              ? ` · ${row.alumni_kelanjutan_studi}`
                              : ""}
                          </p>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <InlinePhoneEdit
                          value={row.no_hp}
                          onSave={(v) => handleFieldUpdate(row, "no_hp", v)}
                        />
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
            {filteredTargets.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <Crosshair className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {searchQuery || activeFilterCount > 0
                    ? "Tidak ada data yang cocok"
                    : "Belum ada target. Minta admin mengatur angkatan Anda."}
                </p>
              </div>
            ) : (
              filteredTargets.map((row) => (
                <div key={row.alumni_id} className="px-4 py-3 space-y-2">
                  {/* Name + angkatan */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {row.nama}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        TN {row.angkatan}
                        {row.alumni_kelanjutan_studi
                          ? ` · ${row.alumni_kelanjutan_studi}`
                          : ""}
                      </p>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#0B27BC]/10 text-[#0B27BC] font-medium shrink-0">
                      TN{row.angkatan}
                    </span>
                  </div>

                  {/* Phone */}
                  <div className="flex items-center gap-2">
                    <Phone className="w-3 h-3 text-gray-400 shrink-0" />
                    <InlinePhoneEdit
                      value={row.no_hp}
                      onSave={(v) => handleFieldUpdate(row, "no_hp", v)}
                    />
                  </div>

                  {/* Status chips grid */}
                  <div className="flex flex-wrap gap-1.5">
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
                      <span className="text-[9px] text-gray-400 w-6">DPT</span>
                      <StatusChip
                        value={row.status_dpt}
                        onClick={() => toggleBinary(row, "status_dpt")}
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] text-gray-400 w-7">Vote</span>
                      <StatusChip
                        value={row.vote}
                        onClick={() => toggleBinary(row, "vote")}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
