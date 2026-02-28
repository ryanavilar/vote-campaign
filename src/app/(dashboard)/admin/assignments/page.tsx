"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRole } from "@/lib/RoleContext";
import { useToast } from "@/components/Toast";
import { formatNum } from "@/lib/format";
import type { StatusValue } from "@/lib/types";
import {
  Search,
  Loader2,
  UserPlus,
  Phone,
  MessageCircle,
  ThumbsUp,
  HelpCircle,
  ArrowLeftRight,
  Users as UsersIcon,
  CalendarCheck,
  RefreshCw,
  Filter,
  X,
  AlertTriangle,
  Crosshair,
  ChevronDown,
  ChevronRight,
  TrendingUp,
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
}

/* ── Dukungan config ───────────────────────────────────── */

const DUKUNGAN_SELECT_STYLES: Record<string, string> = {
  dukung: "bg-emerald-100 text-emerald-700 border-emerald-200",
  ragu_ragu: "bg-yellow-100 text-yellow-700 border-yellow-200",
  milih_sebelah: "bg-red-100 text-red-700 border-red-200",
  terkonvert: "bg-blue-100 text-blue-700 border-blue-200",
};

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
      <button onClick={() => { setDraft(value); setEditing(true); }} className="text-xs text-left w-full px-2 py-1 rounded hover:bg-gray-100 transition-colors min-w-[90px] truncate">
        {value || <span className="text-gray-300 italic">+ No HP</span>}
      </button>
    );
  }

  return (
    <div className="relative min-w-[90px]">
      <input ref={inputRef} type="tel" inputMode="numeric" value={draft}
        onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setDraft(value); setEditing(false); } }}
        className="text-xs w-full px-2 py-1 border border-[#0B27BC] rounded focus:outline-none focus:ring-1 focus:ring-[#0B27BC]/30"
        placeholder="628xxxxxxxxxx"
      />
      <p className="text-[9px] text-[#0B27BC]/70 mt-0.5 px-1">628xxx (bukan 08xxx)</p>
    </div>
  );
}

/* ── Status Chip (binary) ──────────────────────────────── */

function StatusChip({ value, onClick, disabled, readOnly }: { value: StatusValue; onClick?: () => void; disabled?: boolean; readOnly?: boolean }) {
  const isSudah = value === "Sudah";
  if (readOnly) {
    return (
      <span className={`text-[10px] px-2 py-1 rounded-full font-medium whitespace-nowrap inline-block ${isSudah ? "bg-emerald-100/60 text-emerald-600" : "bg-gray-50 text-gray-300"}`}>
        {isSudah ? "Sudah" : "Belum"}
      </span>
    );
  }
  return (
    <button onClick={onClick} disabled={disabled}
      className={`text-[10px] px-2 py-1 rounded-full font-medium transition-all whitespace-nowrap cursor-pointer border ${isSudah ? "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200 hover:border-emerald-300" : "bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200 hover:border-gray-300"} active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed`}
      title="Klik untuk mengubah"
    >
      {isSudah ? "Sudah" : "Belum"}
    </button>
  );
}

/* ── Dukungan Select ──────────────────────────────────── */

function DukunganSelect({ value, onChange, disabled }: { value: string | null; onChange: (v: string | null) => void; disabled?: boolean }) {
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

/* ── Mini Progress Bar ───────────────────────────────── */

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

/* ── Compute Stats Helper ────────────────────────────── */

function computeStats(members: MonitorRow[]): CampaignerStats {
  return {
    total: members.length,
    kontak: members.filter((r) => r.sudah_dikontak === "Sudah").length,
    dukung: members.filter((r) => r.dukungan === "dukung" || r.dukungan === "terkonvert").length,
    ragu: members.filter((r) => r.dukungan === "ragu_ragu").length,
    sebelah: members.filter((r) => r.dukungan === "milih_sebelah").length,
    grup: members.filter((r) => r.masuk_grup === "Sudah").length,
  };
}

/* ── Campaigner Section ──────────────────────────────── */

function CampaignerSection({
  title,
  subtitle,
  members,
  stats,
  isExpanded,
  onToggle,
  onFieldUpdate,
  onToggleBinary,
  searchQuery,
  filterAngkatan,
}: {
  title: string;
  subtitle?: string;
  members: MonitorRow[];
  stats: CampaignerStats;
  isExpanded: boolean;
  onToggle: () => void;
  onFieldUpdate: (row: MonitorRow, field: string, value: string | null) => void;
  onToggleBinary: (row: MonitorRow, field: string) => void;
  searchQuery: string;
  filterAngkatan: string;
}) {
  // Filter members by search & angkatan
  const filtered = useMemo(() => {
    return members.filter((r) => {
      const q = searchQuery.toLowerCase();
      if (q && !r.nama.toLowerCase().includes(q) && !(r.no_hp && r.no_hp.includes(searchQuery))) return false;
      if (filterAngkatan !== "all" && r.angkatan !== Number(filterAngkatan)) return false;
      return true;
    });
  }, [members, searchQuery, filterAngkatan]);

  const filteredStats = useMemo(() => computeStats(filtered), [filtered]);
  const displayStats = searchQuery || filterAngkatan !== "all" ? filteredStats : stats;

  if (searchQuery || filterAngkatan !== "all") {
    if (filtered.length === 0) return null;
  }

  const kontakPct = displayStats.total > 0 ? Math.round((displayStats.kontak / displayStats.total) * 100) : 0;
  const dukungPct = displayStats.total > 0 ? Math.round((displayStats.dukung / displayStats.total) * 100) : 0;

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
      {/* Campaigner Header — always visible */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50/50 transition-colors text-left"
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-foreground truncate">{title}</h3>
            {subtitle && (
              <span className="text-[10px] text-muted-foreground">{subtitle}</span>
            )}
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#0B27BC]/10 text-[#0B27BC]">
              {formatNum(displayStats.total)} target
            </span>
          </div>

          {/* Mini stats row */}
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <div className="flex items-center gap-1">
              <MessageCircle className="w-3 h-3 text-[#0B27BC]" />
              <span className="text-[10px] text-gray-600">
                {formatNum(displayStats.kontak)} <span className="text-gray-400">kontak</span>
              </span>
            </div>
            <div className="flex items-center gap-1">
              <ThumbsUp className="w-3 h-3 text-emerald-600" />
              <span className="text-[10px] text-gray-600">
                {formatNum(displayStats.dukung)} <span className="text-gray-400">dukung</span>
              </span>
            </div>
            {displayStats.ragu > 0 && (
              <div className="flex items-center gap-1">
                <HelpCircle className="w-3 h-3 text-yellow-600" />
                <span className="text-[10px] text-gray-600">{formatNum(displayStats.ragu)} ragu</span>
              </div>
            )}
            {displayStats.sebelah > 0 && (
              <div className="flex items-center gap-1">
                <ArrowLeftRight className="w-3 h-3 text-red-600" />
                <span className="text-[10px] text-gray-600">{formatNum(displayStats.sebelah)} sebelah</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <UsersIcon className="w-3 h-3 text-[#84303F]" />
              <span className="text-[10px] text-gray-600">
                {formatNum(displayStats.grup)} <span className="text-gray-400">grup</span>
              </span>
            </div>
          </div>

          {/* Progress bars */}
          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center gap-1.5 flex-1">
              <span className="text-[9px] text-gray-400 w-10 shrink-0">Kontak</span>
              <ProgressBar value={displayStats.kontak} max={displayStats.total} color="bg-[#0B27BC]" />
            </div>
            <div className="flex items-center gap-1.5 flex-1">
              <span className="text-[9px] text-gray-400 w-10 shrink-0">Dukung</span>
              <ProgressBar value={displayStats.dukung} max={displayStats.total} color="bg-emerald-500" />
            </div>
          </div>
        </div>

        {/* Summary badge on right */}
        <div className="hidden sm:flex flex-col items-end gap-1 shrink-0 ml-2">
          <div className="flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-[#0B27BC]" />
            <span className="text-sm font-bold text-[#0B27BC]">{kontakPct}%</span>
          </div>
          <span className="text-[9px] text-gray-400">contacted</span>
          <span className={`text-xs font-bold ${dukungPct >= 50 ? "text-emerald-600" : dukungPct >= 25 ? "text-yellow-600" : "text-gray-400"}`}>
            {dukungPct}% dukung
          </span>
        </div>
      </button>

      {/* Expanded member list */}
      {isExpanded && (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto border-t border-border">
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
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center">
                      <p className="text-sm text-muted-foreground">Tidak ada data yang cocok</p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((row, idx) => {
                    const isGrupSudah = row.masuk_grup === "Sudah";
                    return (
                      <tr key={row.member_id} className="border-b border-border last:border-b-0 hover:bg-gray-50/50 transition-colors">
                        <td className="px-3 py-2 text-gray-400 text-xs">{idx + 1}</td>
                        <td className="px-3 py-2">
                          <div>
                            <p className="text-sm font-medium text-foreground truncate max-w-[200px]">{row.nama}</p>
                            <p className="text-[10px] text-muted-foreground">
                              TN {row.angkatan}
                              {row.alumni_kelanjutan_studi ? ` · ${row.alumni_kelanjutan_studi}` : ""}
                            </p>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <InlinePhoneEdit value={row.no_hp} onSave={(v) => onFieldUpdate(row, "no_hp", v)} />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <span className={`text-xs font-semibold ${row.attendance_count > 0 ? "text-[#0B27BC]" : "text-gray-300"}`}>
                            {row.attendance_count}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-center">
                          <StatusChip value={row.sudah_dikontak} onClick={!isGrupSudah ? () => onToggleBinary(row, "sudah_dikontak") : undefined} readOnly={isGrupSudah} />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <DukunganSelect value={row.dukungan} onChange={(v) => onFieldUpdate(row, "dukungan", v)} />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <StatusChip value={row.masuk_grup} readOnly />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <StatusChip value={row.status_dpt} onClick={() => onToggleBinary(row, "status_dpt")} />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <StatusChip value={row.vote} onClick={() => onToggleBinary(row, "vote")} />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-border border-t border-border">
            {filtered.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-muted-foreground">Tidak ada data yang cocok</p>
              </div>
            ) : (
              filtered.map((row) => {
                const isGrupSudah = row.masuk_grup === "Sudah";
                return (
                  <div key={row.member_id} className="px-4 py-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{row.nama}</p>
                        <p className="text-[10px] text-muted-foreground">
                          TN {row.angkatan}
                          {row.alumni_kelanjutan_studi ? ` · ${row.alumni_kelanjutan_studi}` : ""}
                        </p>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#0B27BC]/10 text-[#0B27BC] font-medium shrink-0">TN{row.angkatan}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Phone className="w-3 h-3 text-gray-400 shrink-0" />
                      <InlinePhoneEdit value={row.no_hp} onSave={(v) => onFieldUpdate(row, "no_hp", v)} />
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-gray-400 w-8">Event</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${row.attendance_count > 0 ? "bg-[#0B27BC]/10 text-[#0B27BC]" : "bg-gray-50 text-gray-300"}`}>
                          {row.attendance_count}×
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-gray-400 w-10">Kontak</span>
                        <StatusChip value={row.sudah_dikontak} onClick={!isGrupSudah ? () => onToggleBinary(row, "sudah_dikontak") : undefined} readOnly={isGrupSudah} />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-gray-400 w-12">Dukung</span>
                        <DukunganSelect value={row.dukungan} onChange={(v) => onFieldUpdate(row, "dukungan", v)} />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-gray-400 w-7">Grup</span>
                        <StatusChip value={row.masuk_grup} readOnly />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-gray-400 w-6">DPT</span>
                        <StatusChip value={row.status_dpt} onClick={() => onToggleBinary(row, "status_dpt")} />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-gray-400 w-7">Vote</span>
                        <StatusChip value={row.vote} onClick={() => onToggleBinary(row, "vote")} />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
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

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAngkatan, setFilterAngkatan] = useState<string>("all");

  // Expanded sections
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    const allIds = new Set<string>();
    campaigners.forEach((c) => allIds.add(c.user_id));
    allIds.add("unassigned");
    setExpandedSections(allIds);
  };

  const collapseAll = () => {
    setExpandedSections(new Set());
  };

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

  // Available angkatans
  const availableAngkatan = useMemo(() => {
    const set = new Set<number>();
    rows.forEach((r) => set.add(r.angkatan));
    return Array.from(set).sort((a, b) => a - b);
  }, [rows]);

  // Global stats
  const globalStats = useMemo(() => computeStats(rows), [rows]);

  // Group members by campaigner
  const campaignerGroups = useMemo(() => {
    const groups: { id: string; title: string; subtitle?: string; members: MonitorRow[]; stats: CampaignerStats }[] = [];

    // For each campaigner, gather their assigned members
    for (const c of campaigners) {
      const members = rows.filter((r) => r.campaigner_ids.includes(c.user_id));
      if (members.length === 0) continue;
      groups.push({
        id: c.user_id,
        title: c.email.split("@")[0],
        subtitle: c.email,
        members,
        stats: computeStats(members),
      });
    }

    // Sort by total members descending
    groups.sort((a, b) => b.stats.total - a.stats.total);

    // Unassigned members
    const unassigned = rows.filter((r) => r.campaigner_ids.length === 0);
    if (unassigned.length > 0) {
      groups.push({
        id: "unassigned",
        title: "Belum Ditugaskan",
        subtitle: `${unassigned.length} anggota belum memiliki Tim Sukses`,
        members: unassigned,
        stats: computeStats(unassigned),
      });
    }

    return groups;
  }, [rows, campaigners]);

  // Update handler
  const handleFieldUpdate = useCallback(
    async (row: MonitorRow, field: string, value: string | null) => {
      // Optimistic update
      setRows((prev) => prev.map((r) => r.member_id === row.member_id ? { ...r, [field]: value } : r));

      try {
        const res = await fetch(`/api/members/${row.member_id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: value }),
        });
        if (!res.ok) {
          fetchData();
          showToast("Gagal mengupdate", "error");
        }
      } catch {
        fetchData();
        showToast("Gagal mengupdate", "error");
      }
    },
    [fetchData, showToast]
  );

  const toggleBinary = useCallback((row: MonitorRow, field: string) => {
    const current = row[field as keyof MonitorRow] as StatusValue;
    const next = current === "Sudah" ? "Belum" : "Sudah";
    handleFieldUpdate(row, field, next);
  }, [handleFieldUpdate]);

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
                  {formatNum(globalStats.total)} anggota · {formatNum(campaigners.length)} Tim Sukses
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

        {/* Search + Filter Bar */}
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-4 py-3">
            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-[150px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Cari nama / HP..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC]" />
              </div>
              {availableAngkatan.length > 1 && (
                <select value={filterAngkatan} onChange={(e) => setFilterAngkatan(e.target.value)} className="px-3 py-2 text-sm border border-border rounded-lg bg-white">
                  <option value="all">Semua TN</option>
                  {availableAngkatan.map((a) => <option key={a} value={a}>TN {a}</option>)}
                </select>
              )}
              <button onClick={expandAll} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-border rounded-lg bg-white text-gray-600 hover:bg-gray-50 transition-colors">
                <ChevronDown className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Buka Semua</span>
              </button>
              <button onClick={collapseAll} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-border rounded-lg bg-white text-gray-600 hover:bg-gray-50 transition-colors">
                <ChevronRight className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tutup Semua</span>
              </button>
            </div>
          </div>
        </div>

        {/* Campaigner Sections */}
        <div className="space-y-3">
          {campaignerGroups.length === 0 ? (
            <div className="bg-white rounded-xl border border-border shadow-sm p-12 text-center">
              <Crosshair className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Belum ada data Tim Sukses.</p>
            </div>
          ) : (
            campaignerGroups.map((group) => (
              <CampaignerSection
                key={group.id}
                title={group.title}
                subtitle={group.subtitle}
                members={group.members}
                stats={group.stats}
                isExpanded={expandedSections.has(group.id)}
                onToggle={() => toggleSection(group.id)}
                onFieldUpdate={handleFieldUpdate}
                onToggleBinary={toggleBinary}
                searchQuery={searchQuery}
                filterAngkatan={filterAngkatan}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
