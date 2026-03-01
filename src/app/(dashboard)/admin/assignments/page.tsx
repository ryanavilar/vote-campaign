"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Phone,
  CalendarCheck,
  Search,
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
  angkatan: number[];
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
  attendance_count: number;
}

/* ── Dukungan config ───────────────────────────────────── */

const DUKUNGAN_SELECT_STYLES: Record<string, string> = {
  dukung: "bg-emerald-100 text-emerald-700 border-emerald-200",
  ragu_ragu: "bg-yellow-100 text-yellow-700 border-yellow-200",
  milih_sebelah: "bg-red-100 text-red-700 border-red-200",
  terkonvert: "bg-blue-100 text-blue-700 border-blue-200",
};

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

/* ── Inline Phone Edit ─────────────────────────────────── */

function InlinePhoneEdit({ value, onSave }: { value: string; onSave: (v: string) => void }) {
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
    </div>
  );
}

/* ── Status Chip (binary) ──────────────────────────────── */

function StatusChip({ value, onClick, disabled, readOnly }: {
  value: StatusValue; onClick?: () => void; disabled?: boolean; readOnly?: boolean;
}) {
  const isSudah = value === "Sudah";
  if (readOnly) {
    return (
      <span className={`text-[10px] px-2 py-1 rounded-full font-medium whitespace-nowrap inline-block ${
        isSudah ? "bg-emerald-100/60 text-emerald-600" : "bg-gray-50 text-gray-300"
      }`} title={isSudah ? "Otomatis dari WA Group" : "Belum di WA Group"}>
        {isSudah ? "Sudah" : "Belum"}
      </span>
    );
  }
  return (
    <button onClick={onClick} disabled={disabled}
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

function DukunganSelect({ value, onChange, disabled }: {
  value: string | null; onChange: (v: string | null) => void; disabled?: boolean;
}) {
  const style = value ? DUKUNGAN_SELECT_STYLES[value] || "bg-gray-100 text-gray-500 border-gray-200" : "bg-gray-100 text-gray-500 border-gray-200";
  return (
    <select value={value || ""} onChange={(e) => onChange(e.target.value || null)} disabled={disabled}
      className={`text-[10px] pl-1.5 pr-5 py-1 rounded-full font-medium border cursor-pointer transition-all appearance-none bg-[length:12px] bg-[right_4px_center] bg-no-repeat disabled:opacity-50 disabled:cursor-not-allowed ${style}`}
      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")` }}
    >
      <option value="">—</option>
      <option value="dukung">Dukung</option>
      <option value="ragu_ragu">Ragu</option>
      <option value="milih_sebelah">Sebelah</option>
      <option value="terkonvert">Convert</option>
    </select>
  );
}

/* ── Paginated Drill-Down Table ──────────────────────── */

const DRILL_LIMIT = 50;

function DrillDownTable({ campaignerId, showToast }: {
  campaignerId: string;
  showToast: (msg: string, type?: "success" | "error") => void;
}) {
  const [targets, setTargets] = useState<TargetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [availableAngkatan, setAvailableAngkatan] = useState<number[]>([]);

  // Search: debounced
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [filterAngkatan, setFilterAngkatan] = useState("");

  // Fetch targets for the current page
  const fetchPage = useCallback(async (p: number, search: string, angkatan: string) => {
    setLoading(true);
    const params = new URLSearchParams({
      user_id: campaignerId,
      page: String(p),
      limit: String(DRILL_LIMIT),
    });
    if (search) params.set("search", search);
    if (angkatan) params.set("angkatan", angkatan);

    try {
      const res = await fetch(`/api/targets?${params}`);
      if (res.ok) {
        const json = await res.json();
        setTargets(json.data || []);
        setTotal(json.total || 0);
        setTotalPages(json.totalPages || 1);
        setPage(json.page || 1);
        setAvailableAngkatan(json.availableAngkatan || []);
      } else {
        showToast("Gagal memuat data target", "error");
      }
    } catch {
      showToast("Gagal memuat data target", "error");
    }
    setLoading(false);
  }, [campaignerId, showToast]);

  // Initial load
  useEffect(() => {
    fetchPage(1, "", "");
  }, [fetchPage]);

  // Debounce search
  const handleSearchInput = (val: string) => {
    setSearchInput(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchQuery(val);
      setPage(1);
      fetchPage(1, val, filterAngkatan);
    }, 400);
  };

  // Angkatan filter change
  const handleAngkatanChange = (val: string) => {
    setFilterAngkatan(val);
    setPage(1);
    fetchPage(1, searchQuery, val);
  };

  // Page navigation
  const goToPage = (p: number) => {
    setPage(p);
    fetchPage(p, searchQuery, filterAngkatan);
  };

  // Refresh current page
  const refreshCurrent = () => fetchPage(page, searchQuery, filterAngkatan);

  // ── Edit handlers ──
  const handleFieldUpdate = useCallback(
    async (row: TargetRow, field: string, value: string | null) => {
      // Optimistic update
      setTargets((prev) =>
        prev.map((t) => t.alumni_id === row.alumni_id ? { ...t, [field]: value } : t)
      );

      if (row.member_id) {
        try {
          const res = await fetch(`/api/members/${row.member_id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ [field]: value }),
          });
          if (!res.ok) { refreshCurrent(); showToast("Gagal mengupdate", "error"); }
        } catch { refreshCurrent(); showToast("Gagal mengupdate", "error"); }
      } else {
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
                  ? { ...t, member_id: data.member_id, no: data.member?.no || t.no, no_hp: data.member?.no_hp || t.no_hp, status_dpt: data.member?.status_dpt ?? t.status_dpt, sudah_dikontak: data.member?.sudah_dikontak ?? t.sudah_dikontak, vote: data.member?.vote ?? t.vote, dukungan: data.member?.dukungan ?? t.dukungan }
                  : t
              )
            );
          } else { refreshCurrent(); showToast("Gagal membuat data anggota", "error"); }
        } catch { refreshCurrent(); showToast("Gagal membuat data anggota", "error"); }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showToast, page, searchQuery, filterAngkatan, campaignerId]
  );

  const toggleBinary = (row: TargetRow, field: string) => {
    const current = row[field as keyof TargetRow] as StatusValue;
    handleFieldUpdate(row, field, current === "Sudah" ? "Belum" : "Sudah");
  };

  // ── Render ──
  return (
    <div className="space-y-3">
      {/* Search + Angkatan + Refresh */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[130px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => handleSearchInput(e.target.value)}
            placeholder="Cari nama / HP..."
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC] bg-white"
          />
        </div>
        {availableAngkatan.length > 1 && (
          <select
            value={filterAngkatan}
            onChange={(e) => handleAngkatanChange(e.target.value)}
            className="px-2 py-1.5 text-xs border border-border rounded-lg bg-white"
          >
            <option value="">Semua TN</option>
            {availableAngkatan.map((a) => (
              <option key={a} value={a}>TN {a}</option>
            ))}
          </select>
        )}
        <button
          onClick={refreshCurrent}
          className="text-xs text-[#0B27BC] hover:text-[#0B27BC]/80 inline-flex items-center gap-1 px-2.5 py-1.5 border border-border rounded-lg bg-white hover:bg-gray-50"
        >
          <RefreshCw className="w-3 h-3" />
          Refresh
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-border overflow-hidden">
        <div className="px-3 py-2 border-b border-border bg-gray-50/80 flex items-center justify-between">
          <h4 className="text-xs font-semibold text-foreground">
            Daftar Target ({formatNum(total)})
          </h4>
          {totalPages > 1 && (
            <span className="text-[10px] text-muted-foreground">
              Hal {page}/{totalPages}
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-[#0B27BC] mr-2" />
            <span className="text-sm text-muted-foreground">Memuat...</span>
          </div>
        ) : (
          <>
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
                  {targets.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center">
                        <Crosshair className="w-6 h-6 text-gray-200 mx-auto mb-1" />
                        <p className="text-xs text-muted-foreground">
                          {searchInput || filterAngkatan ? "Tidak ada data yang cocok" : "Belum ada target."}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    targets.map((row, idx) => (
                      <tr key={row.alumni_id} className="border-b border-border last:border-b-0 hover:bg-gray-50/50 transition-colors">
                        <td className="px-3 py-2 text-gray-400 text-xs">{(page - 1) * DRILL_LIMIT + idx + 1}</td>
                        <td className="px-3 py-2">
                          <div>
                            <p className="text-sm font-medium text-foreground truncate max-w-[200px]">{row.nama}</p>
                            <p className="text-[10px] text-muted-foreground">
                              TN {row.angkatan}{row.alumni_kelanjutan_studi ? ` · ${row.alumni_kelanjutan_studi}` : ""}
                            </p>
                          </div>
                        </td>
                        <td className="px-3 py-2"><InlinePhoneEdit value={row.no_hp} onSave={(v) => handleFieldUpdate(row, "no_hp", v)} /></td>
                        <td className="px-2 py-2 text-center">
                          <span className={`text-xs font-semibold ${row.attendance_count > 0 ? "text-[#0B27BC]" : "text-gray-300"}`}>{row.attendance_count}</span>
                        </td>
                        <td className="px-2 py-2 text-center">
                          <StatusChip value={row.sudah_dikontak} onClick={row.masuk_grup !== "Sudah" ? () => toggleBinary(row, "sudah_dikontak") : undefined} readOnly={row.masuk_grup === "Sudah"} />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <DukunganSelect value={row.dukungan} onChange={(v) => handleFieldUpdate(row, "dukungan", v)} />
                        </td>
                        <td className="px-2 py-2 text-center"><StatusChip value={row.masuk_grup} readOnly /></td>
                        <td className="px-2 py-2 text-center"><StatusChip value={row.status_dpt} onClick={() => toggleBinary(row, "status_dpt")} /></td>
                        <td className="px-2 py-2 text-center"><StatusChip value={row.vote} onClick={() => toggleBinary(row, "vote")} /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-border">
              {targets.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <Crosshair className="w-6 h-6 text-gray-200 mx-auto mb-1" />
                  <p className="text-xs text-muted-foreground">
                    {searchInput || filterAngkatan ? "Tidak ada data yang cocok" : "Belum ada target."}
                  </p>
                </div>
              ) : (
                targets.map((row) => (
                  <div key={row.alumni_id} className="px-3 py-2.5 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{row.nama}</p>
                        <p className="text-[10px] text-muted-foreground">
                          TN {row.angkatan}{row.alumni_kelanjutan_studi ? ` · ${row.alumni_kelanjutan_studi}` : ""}
                        </p>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#0B27BC]/10 text-[#0B27BC] font-medium shrink-0">TN{row.angkatan}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-3 h-3 text-gray-400 shrink-0" />
                      <InlinePhoneEdit value={row.no_hp} onSave={(v) => handleFieldUpdate(row, "no_hp", v)} />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-gray-400 w-8">Event</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${row.attendance_count > 0 ? "bg-[#0B27BC]/10 text-[#0B27BC]" : "bg-gray-50 text-gray-300"}`}>{row.attendance_count}x</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-gray-400 w-10">Kontak</span>
                        <StatusChip value={row.sudah_dikontak} onClick={row.masuk_grup !== "Sudah" ? () => toggleBinary(row, "sudah_dikontak") : undefined} readOnly={row.masuk_grup === "Sudah"} />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-gray-400 w-12">Dukung</span>
                        <DukunganSelect value={row.dukungan} onChange={(v) => handleFieldUpdate(row, "dukungan", v)} />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-gray-400 w-7">Grup</span>
                        <StatusChip value={row.masuk_grup} readOnly />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-gray-400 w-6">DPT</span>
                        <StatusChip value={row.status_dpt} onClick={() => toggleBinary(row, "status_dpt")} />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-gray-400 w-7">Vote</span>
                        <StatusChip value={row.vote} onClick={() => toggleBinary(row, "vote")} />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-3 py-2.5 border-t border-border bg-gray-50/50 flex items-center justify-between">
                <button
                  onClick={() => goToPage(page - 1)}
                  disabled={page <= 1}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-600 bg-white border border-border rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Prev
                </button>
                <span className="text-xs text-muted-foreground">
                  Hal <span className="font-semibold text-foreground">{page}</span> dari{" "}
                  <span className="font-semibold text-foreground">{totalPages}</span>
                  <span className="text-gray-400 ml-1">({formatNum(total)} target)</span>
                </span>
                <button
                  onClick={() => goToPage(page + 1)}
                  disabled={page >= totalPages}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-600 bg-white border border-border rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ── Tim Sukses Card ─────────────────────────────────── */

function TimSuksesCard({
  title,
  email,
  stats,
  rank,
  angkatan,
  totalAlumni,
  expanded,
  onToggle,
}: {
  title: string;
  email: string;
  stats: CampaignerStats;
  rank: number;
  angkatan: number[];
  totalAlumni: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      <button onClick={onToggle} className="w-full text-left px-4 py-3 cursor-pointer">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
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
          <div className="flex items-center gap-2 shrink-0 ml-2">
            <div className="text-right">
              <p className="text-lg font-bold text-[#0B27BC]">{formatNum(stats.total)}</p>
              <p className="text-[9px] text-muted-foreground">target</p>
              {totalAlumni > 0 && (
                <p className="text-[9px] text-muted-foreground">
                  <span className="font-semibold text-[#84303F]">{formatNum(totalAlumni)}</span> alumni
                </p>
              )}
            </div>
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
          </div>
        </div>

        {/* Angkatan badges */}
        {angkatan.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {angkatan.map((a) => (
              <span key={a} className="text-[9px] px-1.5 py-0.5 rounded bg-[#0B27BC]/10 text-[#0B27BC] font-semibold">
                TN {a}
              </span>
            ))}
          </div>
        )}

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
      </button>
    </div>
  );
}

/* ── Main Page ─────────────────────────────────────────── */

export default function AdminAssignmentsPage() {
  const { canManageUsers: userCanManage, loading: roleLoading } = useRole();
  const { showToast } = useToast();

  const [rows, setRows] = useState<MonitorRow[]>([]);
  const [campaigners, setCampaigners] = useState<CampaignerInfo[]>([]);
  const [alumniCountByAngkatan, setAlumniCountByAngkatan] = useState<Record<number, number>>({});
  const [loadingData, setLoadingData] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoadingData(true);
    try {
      const res = await fetch("/api/assignments/monitor");
      if (res.ok) {
        const data = await res.json();
        setRows(data.members || []);
        setCampaigners(data.campaigners || []);
        setAlumniCountByAngkatan(data.alumniCountByAngkatan || {});
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

  const globalStats = useMemo(() => computeStats(rows), [rows]);

  const campaignerCards = useMemo(() => {
    const cards: { id: string; title: string; email: string; stats: CampaignerStats; angkatan: number[]; totalAlumni: number }[] = [];

    for (const c of campaigners) {
      const members = rows.filter((r) => r.campaigner_ids.includes(c.user_id));
      if (members.length === 0) continue;

      // Sum alumni count from all assigned angkatan
      const totalAlumni = (c.angkatan || []).reduce(
        (sum, a) => sum + (alumniCountByAngkatan[a] || 0),
        0
      );

      cards.push({
        id: c.user_id,
        title: c.email.split("@")[0],
        email: c.email,
        stats: computeStats(members),
        angkatan: c.angkatan || [],
        totalAlumni,
      });
    }

    cards.sort((a, b) => {
      const aPct = a.stats.total > 0 ? a.stats.dukung / a.stats.total : 0;
      const bPct = b.stats.total > 0 ? b.stats.dukung / b.stats.total : 0;
      return bPct - aPct;
    });

    return cards;
  }, [rows, campaigners, alumniCountByAngkatan]);

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

            <div className="space-y-3">
              {campaignerCards.map((card, idx) => (
                <div key={card.id}>
                  <TimSuksesCard
                    title={card.title}
                    email={card.email}
                    stats={card.stats}
                    rank={idx + 1}
                    angkatan={card.angkatan}
                    totalAlumni={card.totalAlumni}
                    expanded={expandedId === card.id}
                    onToggle={() => setExpandedId(expandedId === card.id ? null : card.id)}
                  />
                  {expandedId === card.id && (
                    <div className="mt-1 bg-gray-50/50 rounded-xl border border-border p-4 shadow-inner">
                      <DrillDownTable campaignerId={card.id} showToast={showToast} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
