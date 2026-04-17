"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import * as XLSX from "xlsx";
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
  AlertOctagon,
  Merge,
  Plus,
  ClipboardCheck,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
} from "lucide-react";

const PAGE_SIZE = 50;

/* ── Types ─────────────────────────────────────────────── */

interface MemberInfo {
  id: string;
  no: number;
  nama?: string | null;
  no_hp?: string | null;
  pic?: string | null;
  status_dpt?: string | null;
  isi_form_dpt?: string | null;
  registrasi_website_dpt?: string | null;
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

interface AlumniStats {
  total: number;
  linked: number;
  kontak: number;
  dukung: number;
  ragu: number;
  sebelah: number;
  grup: number;
  multiLinked: number;
}

interface PendingMatch {
  id: string;
  similarity: number;
  created_at: string;
  member: { id: string; nama: string; angkatan: number; no_hp: string | null };
  alumni: { id: string; nama: string; angkatan: number };
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
  const { canManageUsers, isSuperAdmin: isSA, loading: roleLoading } = useRole();
  const { showToast } = useToast();

  // All data from API — fetched ONCE, filtered/paginated client-side
  const [allAlumni, setAllAlumni] = useState<AlumniRow[]>([]);
  const [stats, setStats] = useState<AlumniStats>({ total: 0, linked: 0, kontak: 0, dukung: 0, ragu: 0, sebelah: 0, grup: 0, multiLinked: 0 });
  const [availableAngkatan, setAvailableAngkatan] = useState<number[]>([]);
  const [initialLoading, setInitialLoading] = useState(true); // only for first load
  const [refreshing, setRefreshing] = useState(false); // only for manual Refresh button
  const [page, setPage] = useState(1);
  const [unlinkedFormCount, setUnlinkedFormCount] = useState(0);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterAngkatan, setFilterAngkatan] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [fKontak, setFKontak] = useState("all");
  const [fDukungan, setFDukungan] = useState("all");
  const [fGrup, setFGrup] = useState("all");
  const [fDpt, setFDpt] = useState("all");
  const [fFormDpt, setFFormDpt] = useState("all");
  const [fWebDpt, setFWebDpt] = useState("all");
  const [fVote, setFVote] = useState("all");
  const [fPhone, setFPhone] = useState("all");
  const [fLinked, setFLinked] = useState("all");
  const [fMultiLink, setFMultiLink] = useState(false);

  const activeFilterCount = [fKontak, fDukungan, fGrup, fDpt, fFormDpt, fWebDpt, fVote, fPhone].filter((f) => f !== "all").length;

  const resetFilters = () => {
    setFKontak("all"); setFDukungan("all"); setFGrup("all");
    setFDpt("all"); setFFormDpt("all"); setFWebDpt("all");
    setFVote("all"); setFPhone("all");
  };

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Reset page when any filter changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filterAngkatan, fLinked, fMultiLink, fKontak, fDukungan, fGrup, fDpt, fFormDpt, fWebDpt, fVote, fPhone]);

  // Stable ref for showToast
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;

  // Stable ref for filtered alumni (used by export)
  const filteredRef = useRef<AlumniRow[]>([]);

  // Load data from API — called ONCE on mount, silently on error recovery
  const loadData = useCallback(async () => {
    try {
      const [alumniRes, formLogRes] = await Promise.all([
        fetch("/api/alumni"),
        fetch("/api/form-log?limit=1").catch(() => null),
      ]);
      if (alumniRes.ok) {
        const json = await alumniRes.json();
        setAllAlumni(json.data || []);
        setStats(json.stats);
        setAvailableAngkatan(json.availableAngkatan || []);
      } else {
        showToastRef.current("Gagal memuat data alumni", "error");
      }
      if (formLogRes?.ok) {
        const formJson = await formLogRes.json();
        setUnlinkedFormCount(formJson.unlinked_count || 0);
      }
    } catch {
      showToastRef.current("Gagal memuat data alumni", "error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Export filtered alumni to Excel
  const handleExport = useCallback(() => {
    const rows = filteredRef.current;
    const data = rows.map((a, idx) => {
      const m = a.members && a.members.length > 0 ? a.members[0] : null;
      return {
        No: idx + 1,
        "Nama Alumni": a.nama,
        Angkatan: a.angkatan,
        Nosis: a.nosis ?? "",
        Keterangan: a.keterangan ?? "",
        "No HP": m?.no_hp ?? "",
        "Sudah Dikontak": m?.sudah_dikontak ?? "",
        Dukungan: m?.dukungan ?? "",
        "Masuk Grup": m?.masuk_grup ?? "",
        "Status DPT": m?.status_dpt ?? "",
        "Form DPT": m?.isi_form_dpt ?? "",
        "Web DPT": m?.registrasi_website_dpt ?? "",
        Vote: m?.vote ?? "",
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [
      { wch: 5 }, { wch: 28 }, { wch: 9 }, { wch: 12 }, { wch: 24 },
      { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 14 },
      { wch: 12 }, { wch: 12 }, { wch: 12 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Alumni");
    const ts = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `alumni-${ts}.xlsx`);
  }, []);

  // Manual refresh — only the Refresh button uses this
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // Fetch once when role is ready
  useEffect(() => {
    if (roleLoading) return;
    if (!canManageUsers) { setInitialLoading(false); return; }
    let cancelled = false;
    (async () => {
      await loadData();
      if (!cancelled) setInitialLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleLoading]);

  // ── Client-side filtering ──
  const filtered = useMemo(() => {
    let result = allAlumni;

    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter((item) => {
        const member = item.members && item.members.length > 0 ? item.members[0] : null;
        return (
          item.nama.toLowerCase().includes(q) ||
          (member?.no_hp && member.no_hp.includes(debouncedSearch))
        );
      });
    }

    if (filterAngkatan !== "all") {
      const num = Number(filterAngkatan);
      result = result.filter((item) => item.angkatan === num);
    }

    if (fLinked === "true") {
      result = result.filter((item) => item.members && item.members.length > 0);
    } else if (fLinked === "false") {
      result = result.filter((item) => !item.members || item.members.length === 0);
    }

    if (fMultiLink) {
      result = result.filter((item) => (item.members?.length || 0) > 1);
    }

    if (fPhone !== "all") {
      result = result.filter((item) => {
        const m = item.members?.[0];
        if (fPhone === "has") return m?.no_hp;
        if (fPhone === "empty") return !m?.no_hp;
        return true;
      });
    }

    if (fKontak !== "all") {
      result = result.filter((item) => {
        const val = item.members?.[0]?.sudah_dikontak || null;
        if (fKontak === "empty") return val === null;
        return val === fKontak;
      });
    }

    if (fDukungan !== "all") {
      result = result.filter((item) => {
        const val = item.members?.[0]?.dukungan || null;
        if (fDukungan === "pendukung") return val === "dukung" || val === "terkonvert";
        if (fDukungan === "empty") return !val;
        return val === fDukungan;
      });
    }

    if (fGrup !== "all") {
      result = result.filter((item) => {
        const val = item.members?.[0]?.masuk_grup || "Belum";
        return val === fGrup;
      });
    }

    if (fDpt !== "all") {
      result = result.filter((item) => {
        const val = item.members?.[0]?.status_dpt || null;
        if (fDpt === "empty") return val === null;
        return val === fDpt;
      });
    }

    if (fFormDpt !== "all") {
      result = result.filter((item) => {
        const val = item.members?.[0]?.isi_form_dpt || null;
        if (fFormDpt === "empty") return val === null;
        return val === fFormDpt;
      });
    }

    if (fWebDpt !== "all") {
      result = result.filter((item) => {
        const val = item.members?.[0]?.registrasi_website_dpt || null;
        if (fWebDpt === "empty") return val === null;
        return val === fWebDpt;
      });
    }

    if (fVote !== "all") {
      result = result.filter((item) => {
        const val = item.members?.[0]?.vote || null;
        if (fVote === "empty") return val === null;
        return val === fVote;
      });
    }

    return result;
  }, [allAlumni, debouncedSearch, filterAngkatan, fLinked, fMultiLink, fPhone, fKontak, fDukungan, fGrup, fDpt, fFormDpt, fWebDpt, fVote]);

  filteredRef.current = filtered;

  // ── Client-side pagination ──
  const totalFiltered = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const alumni = useMemo(() => {
    const offset = (safePage - 1) * PAGE_SIZE;
    return filtered.slice(offset, offset + PAGE_SIZE);
  }, [filtered, safePage]);

  // Auto-link modal state
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkConfirming, setLinkConfirming] = useState(false);
  const [linkPreview, setLinkPreview] = useState<PreviewResult | null>(null);
  const [linkTab, setLinkTab] = useState<LinkTab>("certain");
  const [selectedPairs, setSelectedPairs] = useState<Set<string>>(new Set());
  const [relinkCandidateId, setRelinkCandidateId] = useState<string | null>(null);
  const [relinkQuery, setRelinkQuery] = useState("");
  const [relinkSearchResults, setRelinkSearchResults] = useState<{ id: string; nama: string; angkatan: number }[]>([]);
  const [relinkSearching, setRelinkSearching] = useState(false);

  // Lock to prevent concurrent member-creation calls for the same alumni
  const creatingLockRef = useRef(new Set<string>());

  // Field update handler — optimistic update + API
  const handleFieldUpdate = useCallback(
    async (item: AlumniRow, field: string, value: string | null) => {
      const member = item.members && item.members.length > 0 ? item.members[0] : null;
      const hasRealMember = member && member.id && member.id !== "__temp__";

      // Optimistic update
      setAllAlumni((prev) =>
        prev.map((a) => {
          if (a.id !== item.id) return a;
          if (a.members && a.members.length > 0) {
            return { ...a, members: [{ ...a.members[0], [field]: value }] };
          }
          return { ...a, members: [{ id: "__temp__", no: 0, [field]: value } as MemberInfo] };
        })
      );

      if (hasRealMember) {
        // Member exists with real ID → PATCH
        try {
          const res = await fetch(`/api/members/${member.id}`, {
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
        // No member or __temp__ member → POST to create/update via targets API
        // Prevent concurrent creates for the same alumni
        if (creatingLockRef.current.has(item.id)) return;
        creatingLockRef.current.add(item.id);
        try {
          const res = await fetch("/api/targets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ alumni_id: item.id, field, value }),
          });
          if (res.ok) {
            const data = await res.json();
            setAllAlumni((prev) =>
              prev.map((a) => {
                if (a.id !== item.id) return a;
                return {
                  ...a,
                  members: [{
                    id: data.member_id,
                    no: data.member?.no || 0,
                    no_hp: data.member?.no_hp || "",
                    status_dpt: data.member?.status_dpt ?? null,
                    isi_form_dpt: data.member?.isi_form_dpt ?? null,
                    registrasi_website_dpt: data.member?.registrasi_website_dpt ?? null,
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
            loadData();
            showToastRef.current("Gagal membuat data anggota", "error");
          }
        } catch {
          loadData();
          showToastRef.current("Gagal membuat data anggota", "error");
        } finally {
          creatingLockRef.current.delete(item.id);
        }
      }
    },
    [loadData]
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
        loadData();
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

  // Manual relink in auto-link modal
  const handleAutoLinkRelinkSearch = useCallback(async (query: string, angkatan: number) => {
    setRelinkQuery(query);
    if (query.length < 2) { setRelinkSearchResults([]); return; }
    setRelinkSearching(true);
    try {
      const res = await fetch(`/api/alumni/search?q=${encodeURIComponent(query)}&limit=8&angkatan=${angkatan}`);
      if (res.ok) {
        const json = await res.json();
        setRelinkSearchResults((json.data || []).map((a: { id: string; nama: string; angkatan: number }) => ({
          id: a.id, nama: a.nama, angkatan: a.angkatan,
        })));
      }
    } catch {
      // silent
    }
    setRelinkSearching(false);
  }, []);

  const handleRelinkSelect = (memberId: string, alumni: { id: string; nama: string; angkatan: number }) => {
    if (!linkPreview) return;
    // Update the candidate's alumni to the manually selected one
    const updated = linkPreview.candidates.map((c) =>
      c.member_id === memberId
        ? { ...c, alumni_id: alumni.id, alumni_nama: alumni.nama, alumni_angkatan: alumni.angkatan, similarity: 100, confidence: "certain" as const }
        : c
    );
    // If this member wasn't in candidates yet (no_match), add them
    const exists = updated.some((c) => c.member_id === memberId);
    if (!exists) {
      // This shouldn't happen in current flow but safe guard
    }
    setLinkPreview({ ...linkPreview, candidates: updated });
    setSelectedPairs((prev) => new Set(prev).add(memberId));
    setRelinkCandidateId(null);
    setRelinkQuery("");
    setRelinkSearchResults([]);
  };

  // Add alumni modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ nama: "", angkatan: "" as string, nosis: "", kelanjutan_studi: "", program_studi: "", keterangan: "" });
  const [addSaving, setAddSaving] = useState(false);

  const resetAddForm = () => setAddForm({ nama: "", angkatan: "", nosis: "", kelanjutan_studi: "", program_studi: "", keterangan: "" });

  // Review panel state
  const [pendingMatches, setPendingMatches] = useState<PendingMatch[]>([]);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [relinkingId, setRelinkingId] = useState<string | null>(null);
  const [relinkSearch, setRelinkSearch] = useState("");
  const [relinkResults, setRelinkResults] = useState<{ id: string; nama: string; angkatan: number }[]>([]);
  const [relinkSearchLoading, setRelinkSearchLoading] = useState(false);

  const loadPendingMatches = useCallback(async () => {
    try {
      const res = await fetch("/api/alumni/review");
      if (res.ok) {
        const json = await res.json();
        setPendingMatches(json.pending || []);
      }
    } catch {
      // silent fail
    }
  }, []);

  // Load pending matches on mount
  useEffect(() => {
    if (!canManageUsers || roleLoading) return;
    loadPendingMatches();
  }, [canManageUsers, roleLoading, loadPendingMatches]);

  const handleResolve = async (matchId: string, action: "link" | "reject", alumniId?: string) => {
    setResolvingId(matchId);
    try {
      const res = await fetch("/api/alumni/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          match_id: matchId,
          action: alumniId ? "relink" : action,
          alumni_id: alumniId,
        }),
      });
      if (res.ok) {
        const actionLabel = action === "link" ? "dihubungkan" : action === "reject" ? "ditolak" : "dihubungkan";
        showToast(`Alumni berhasil ${actionLabel}`, "success");
        setPendingMatches((prev) => prev.filter((m) => m.id !== matchId));
        setRelinkingId(null);
        setRelinkSearch("");
        setRelinkResults([]);
        if (action === "link" || alumniId) {
          loadData(); // refresh alumni table
        }
      } else {
        const result = await res.json();
        showToast(result.error || "Gagal memproses", "error");
      }
    } catch {
      showToast("Terjadi kesalahan jaringan", "error");
    }
    setResolvingId(null);
  };

  const handleRelinkSearch = async (query: string) => {
    setRelinkSearch(query);
    if (query.length < 2) { setRelinkResults([]); return; }
    setRelinkSearchLoading(true);
    try {
      const res = await fetch(`/api/alumni/search?q=${encodeURIComponent(query)}&limit=5`);
      if (res.ok) {
        const json = await res.json();
        setRelinkResults((json.data || []).map((a: { id: string; nama: string; angkatan: number }) => ({
          id: a.id, nama: a.nama, angkatan: a.angkatan,
        })));
      }
    } catch {
      // silent
    }
    setRelinkSearchLoading(false);
  };

  const handleAddAlumni = async () => {
    const angkatan = Number(addForm.angkatan);
    if (!addForm.nama.trim()) { showToast("Nama wajib diisi", "error"); return; }
    if (!angkatan || angkatan < 1 || angkatan > 35) { showToast("Angkatan harus antara 1-35", "error"); return; }

    setAddSaving(true);
    try {
      const res = await fetch("/api/alumni", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nama: addForm.nama.trim(),
          angkatan,
          nosis: addForm.nosis.trim() || null,
          kelanjutan_studi: addForm.kelanjutan_studi.trim() || null,
          program_studi: addForm.program_studi.trim() || null,
          keterangan: addForm.keterangan.trim() || null,
        }),
      });
      const result = await res.json();
      if (res.ok) {
        showToast(`Alumni "${result.alumni.nama}" berhasil ditambahkan`, "success");
        setShowAddModal(false);
        resetAddForm();
        // Add to local state without full reload
        setAllAlumni((prev) => {
          const newAlumni: AlumniRow = { ...result.alumni, members: null };
          const updated = [...prev, newAlumni];
          updated.sort((a, b) => a.angkatan - b.angkatan || a.nama.localeCompare(b.nama));
          return updated;
        });
        // Update stats
        setStats((prev) => ({ ...prev, total: prev.total + 1 }));
        // Update available angkatan
        setAvailableAngkatan((prev) => {
          if (prev.includes(angkatan)) return prev;
          return [...prev, angkatan].sort((a, b) => a - b);
        });
      } else {
        showToast(result.error || "Gagal menambahkan alumni", "error");
      }
    } catch {
      showToast("Terjadi kesalahan jaringan", "error");
    }
    setAddSaving(false);
  };

  // Merge handler for multi-linked alumni
  const [mergingId, setMergingId] = useState<string | null>(null);

  const handleMerge = async (alumniId: string, alumniNama: string) => {
    if (!confirm(`Merge semua member untuk ${alumniNama} menjadi satu?\n\nData terbaik akan dipertahankan, nomor HP tambahan dijadikan alt_phones.`)) return;
    setMergingId(alumniId);
    try {
      const res = await fetch("/api/members/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alumni_id: alumniId }),
      });
      const result = await res.json();
      if (res.ok) {
        showToast(`Berhasil merge ${result.merged_count} member duplikat untuk ${alumniNama}`, "success");
        loadData();
      } else {
        showToast(result.error || "Gagal merge", "error");
      }
    } catch {
      showToast("Terjadi kesalahan jaringan", "error");
    }
    setMergingId(null);
  };

  // Page navigation
  const goPage = (p: number) => setPage(Math.max(1, Math.min(totalPages, p)));

  if (roleLoading || initialLoading) {
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
              {pendingMatches.length > 0 && (
                <button
                  onClick={() => setReviewOpen(!reviewOpen)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-amber-500 rounded-lg hover:bg-amber-600 transition-colors"
                >
                  <ClipboardCheck className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Review</span>
                  <span className="bg-white text-amber-600 text-[10px] font-bold rounded-full w-5 h-5 inline-flex items-center justify-center">
                    {pendingMatches.length}
                  </span>
                </button>
              )}
              <button onClick={() => setShowAddModal(true)} className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors">
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tambah Alumni</span>
              </button>
              <button onClick={handleAutoLinkPreview} disabled={showLinkModal} className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-[#84303F] rounded-lg hover:bg-[#6e2835] transition-colors disabled:opacity-50">
                <Link2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Auto-Link</span>
              </button>
              <button onClick={handleExport} className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors">
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Export Excel</span>
              </button>
              <button onClick={handleRefresh} disabled={refreshing} className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-[#0B27BC] bg-white rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50">
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
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

        {/* Unlinked form submissions alert */}
        {unlinkedFormCount > 0 && (
          <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800">
                {unlinkedFormCount} pendaftar dari form belum terhubung ke data alumni
              </p>
              <p className="text-xs text-amber-600 mt-0.5">
                Gunakan Auto-Link atau review manual untuk menghubungkan data pendaftar ke alumni.
              </p>
            </div>
            <button
              onClick={() => window.open("/form-log", "_blank")}
              className="shrink-0 text-xs font-medium text-amber-700 hover:text-amber-900 px-2 py-1 rounded hover:bg-amber-100 transition-colors"
            >
              Lihat Log
            </button>
          </div>
        )}

        {/* Review Panel */}
        {pendingMatches.length > 0 && reviewOpen && (
          <div className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-amber-800 flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4" />
                Perlu Review ({pendingMatches.length})
              </h3>
              <button onClick={() => setReviewOpen(false)} className="p-1 rounded hover:bg-amber-100 transition-colors">
                <X className="w-4 h-4 text-amber-600" />
              </button>
            </div>
            <div className="divide-y divide-border">
              {pendingMatches.map((match) => (
                <div key={match.id} className="px-4 py-3">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    {/* Submitted data */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="text-sm font-medium text-foreground">{match.member.nama}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">TN{match.member.angkatan}</span>
                        {match.member.no_hp && (
                          <span className="text-[10px] text-gray-400 font-mono">{match.member.no_hp}</span>
                        )}
                      </div>
                    </div>

                    {/* Arrow */}
                    <div className="hidden sm:flex items-center px-2">
                      <span className="text-gray-300">&rarr;</span>
                    </div>

                    {/* Matched alumni */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <GraduationCap className="w-3.5 h-3.5 text-[#0B27BC] shrink-0" />
                        <span className="text-sm font-medium text-[#0B27BC]">{match.alumni.nama}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#0B27BC]/10 text-[#0B27BC]">TN{match.alumni.angkatan}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${match.similarity >= 0.8 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                          {Math.round(match.similarity * 100)}%
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {relinkingId === match.id ? (
                        <div className="flex items-center gap-1.5">
                          <div className="relative">
                            <input
                              type="text"
                              value={relinkSearch}
                              onChange={(e) => handleRelinkSearch(e.target.value)}
                              placeholder="Cari alumni..."
                              className="w-40 px-2 py-1 text-xs border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0B27BC]/30"
                              autoFocus
                            />
                            {relinkResults.length > 0 && (
                              <div className="absolute z-10 top-full left-0 mt-1 w-56 bg-white border border-border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                                {relinkResults.map((a) => (
                                  <button
                                    key={a.id}
                                    onClick={() => handleResolve(match.id, "link", a.id)}
                                    disabled={resolvingId === match.id}
                                    className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition-colors flex items-center justify-between"
                                  >
                                    <span className="font-medium truncate">{a.nama}</span>
                                    <span className="text-gray-400 shrink-0 ml-2">TN{a.angkatan}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                            {relinkSearchLoading && (
                              <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 animate-spin text-gray-400" />
                            )}
                          </div>
                          <button
                            onClick={() => { setRelinkingId(null); setRelinkSearch(""); setRelinkResults([]); }}
                            className="p-1 text-gray-400 hover:text-gray-600"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => handleResolve(match.id, "link")}
                            disabled={resolvingId === match.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                          >
                            {resolvingId === match.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                            Link
                          </button>
                          <button
                            onClick={() => handleResolve(match.id, "reject")}
                            disabled={resolvingId === match.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                          >
                            <X className="w-3 h-3" />
                            Tolak
                          </button>
                          <button
                            onClick={() => setRelinkingId(match.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium text-[#0B27BC] bg-[#0B27BC]/10 rounded-lg hover:bg-[#0B27BC]/20 transition-colors"
                          >
                            <Search className="w-3 h-3" />
                            <span className="hidden sm:inline">Pilih Lain</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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
              {stats.multiLinked > 0 && (
                <button
                  onClick={() => setFMultiLink(!fMultiLink)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg transition-colors ${fMultiLink ? "bg-amber-100 text-amber-700 border-amber-300" : "bg-white text-gray-600 border-border hover:bg-gray-50"}`}
                >
                  <AlertOctagon className="w-3.5 h-3.5" />
                  Multi ({stats.multiLinked})
                </button>
              )}
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
                    <label className="text-[10px] text-gray-400 mb-0.5 block">Form DPT</label>
                    <select value={fFormDpt} onChange={(e) => setFFormDpt(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-border rounded-lg bg-white">
                      <option value="all">Semua</option><option value="Sudah">Sudah</option><option value="Belum">Belum</option><option value="empty">Kosong</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 mb-0.5 block">Web DPT</label>
                    <select value={fWebDpt} onChange={(e) => setFWebDpt(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-border rounded-lg bg-white">
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
              Daftar Alumni ({formatNum(totalFiltered)})
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
                  <th className="text-center px-2 py-2 font-semibold text-gray-500 text-xs">Form DPT</th>
                  <th className="text-center px-2 py-2 font-semibold text-gray-500 text-xs">Web DPT</th>
                  <th className="text-center px-2 py-2 font-semibold text-gray-500 text-xs">Vote</th>
                </tr>
              </thead>
              <tbody>
                {alumni.length === 0 && !initialLoading ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <GraduationCap className="w-8 h-8 text-gray-200" />
                        <p className="text-sm text-muted-foreground">
                          {debouncedSearch || filterAngkatan !== "all" || fLinked !== "all" || activeFilterCount > 0
                            ? "Tidak ada data yang cocok"
                            : "Belum ada data alumni."}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  alumni.map((item, idx) => {
                    const member = item.members && item.members.length > 0 ? item.members[0] : null;
                    const isGrupSudah = member?.masuk_grup === "Sudah";
                    const multiCount = item.members?.length || 0;
                    const globalIdx = (safePage - 1) * PAGE_SIZE + idx;

                    return (
                      <tr key={item.id} className={`border-b border-border last:border-b-0 hover:bg-gray-50/50 transition-colors ${multiCount > 1 ? "bg-amber-50/40" : ""}`}>
                        <td className="px-3 py-2 text-gray-400 text-xs">{globalIdx + 1}</td>
                        <td className="px-3 py-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-medium text-foreground truncate max-w-[200px]">{item.nama}</p>
                              {item.keterangan?.includes("Almarhum") && (
                                <span className="text-[9px] font-semibold px-1 py-0.5 rounded bg-gray-100 text-gray-500 shrink-0">Almarhum</span>
                              )}
                              {multiCount >= 1 && (
                                <span className={`inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${multiCount > 1 ? "bg-amber-100 text-amber-700" : "bg-emerald-100/60 text-emerald-600"}`} title={`Terhubung ke ${multiCount} member`}>
                                  {multiCount > 1 ? <AlertOctagon className="w-3 h-3" /> : <Check className="w-3 h-3" />}
                                  {multiCount} member
                                </span>
                              )}
                              {multiCount > 1 && isSA && (
                                <button
                                  onClick={() => handleMerge(item.id, item.nama)}
                                  disabled={mergingId === item.id}
                                  className="inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded bg-[#0B27BC] text-white hover:bg-[#091fa0] transition-colors disabled:opacity-50 shrink-0"
                                  title="Gabung semua member menjadi satu"
                                >
                                  {mergingId === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Merge className="w-3 h-3" />}
                                  Merge
                                </button>
                              )}
                            </div>
                            <p className="text-[10px] text-muted-foreground">
                              TN {item.angkatan}
                              {item.kelanjutan_studi ? ` · ${item.kelanjutan_studi}` : ""}
                            </p>
                            {multiCount > 1 && (
                              <div className="mt-1 space-y-0.5">
                                {item.members!.map((m, mi) => (
                                  <a key={m.id} href={`/anggota/${m.id}`} className="flex items-center gap-1 text-[10px] text-amber-700 hover:text-amber-900 hover:underline">
                                    <User className="w-2.5 h-2.5" />
                                    <span>{m.nama || `Member #${m.no}`}</span>
                                    {m.no_hp && <span className="font-mono text-[9px] text-gray-400">({m.no_hp})</span>}
                                    {mi === 0 && <span className="text-[8px] px-1 rounded bg-amber-200 text-amber-800">utama</span>}
                                  </a>
                                ))}
                              </div>
                            )}
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
                          <StatusChip value={(member?.isi_form_dpt as StatusValue) || null} onClick={() => toggleBinary(item, "isi_form_dpt")} />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <StatusChip value={(member?.registrasi_website_dpt as StatusValue) || null} onClick={() => toggleBinary(item, "registrasi_website_dpt")} />
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
            {alumni.length === 0 && !initialLoading ? (
              <div className="px-4 py-12 text-center">
                <GraduationCap className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {debouncedSearch || filterAngkatan !== "all" || fLinked !== "all" || activeFilterCount > 0
                    ? "Tidak ada data yang cocok"
                    : "Belum ada data alumni."}
                </p>
              </div>
            ) : (
              alumni.map((item) => {
                const member = item.members && item.members.length > 0 ? item.members[0] : null;
                const isGrupSudah = member?.masuk_grup === "Sudah";
                const multiCount = item.members?.length || 0;

                return (
                  <div key={item.id} className={`px-4 py-3 space-y-2 ${multiCount > 1 ? "bg-amber-50/40" : ""}`}>
                    {/* Name + angkatan */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-sm font-medium text-foreground truncate">{item.nama}</p>
                          {item.keterangan?.includes("Almarhum") && (
                            <span className="text-[9px] font-semibold px-1 py-0.5 rounded bg-gray-100 text-gray-500">Almarhum</span>
                          )}
                          {multiCount >= 1 && (
                            <span className={`inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded ${multiCount > 1 ? "bg-amber-100 text-amber-700" : "bg-emerald-100/60 text-emerald-600"}`}>
                              {multiCount > 1 ? <AlertOctagon className="w-3 h-3" /> : <Check className="w-3 h-3" />}
                              {multiCount} member
                            </span>
                          )}
                          {multiCount > 1 && isSA && (
                            <button
                              onClick={() => handleMerge(item.id, item.nama)}
                              disabled={mergingId === item.id}
                              className="inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded bg-[#0B27BC] text-white hover:bg-[#091fa0] transition-colors disabled:opacity-50"
                            >
                              {mergingId === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Merge className="w-3 h-3" />}
                              Merge
                            </button>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          TN {item.angkatan}
                          {item.kelanjutan_studi ? ` · ${item.kelanjutan_studi}` : ""}
                        </p>
                        {multiCount > 1 && (
                          <div className="mt-1 space-y-0.5">
                            {item.members!.map((m, mi) => (
                              <a key={m.id} href={`/anggota/${m.id}`} className="flex items-center gap-1 text-[10px] text-amber-700 hover:text-amber-900 hover:underline">
                                <User className="w-2.5 h-2.5" />
                                <span>{m.nama || `Member #${m.no}`}</span>
                                {m.no_hp && <span className="font-mono text-[9px] text-gray-400">({m.no_hp})</span>}
                                {mi === 0 && <span className="text-[8px] px-1 rounded bg-amber-200 text-amber-800">utama</span>}
                              </a>
                            ))}
                          </div>
                        )}
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
                        <span className="text-[9px] text-gray-400 w-10">Form</span>
                        <StatusChip value={(member?.isi_form_dpt as StatusValue) || null} onClick={() => toggleBinary(item, "isi_form_dpt")} />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-gray-400 w-7">Web</span>
                        <StatusChip value={(member?.registrasi_website_dpt as StatusValue) || null} onClick={() => toggleBinary(item, "registrasi_website_dpt")} />
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-border bg-gray-50/50 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {formatNum((safePage - 1) * PAGE_SIZE + 1)}–{formatNum(Math.min(safePage * PAGE_SIZE, totalFiltered))} dari {formatNum(totalFiltered)}
              </p>
              <div className="flex items-center gap-1">
                <button onClick={() => goPage(1)} disabled={safePage === 1} className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title="Halaman pertama">
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <button onClick={() => goPage(safePage - 1)} disabled={safePage === 1} className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title="Sebelumnya">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 py-1 text-xs font-medium text-foreground">
                  {safePage} / {totalPages}
                </span>
                <button onClick={() => goPage(safePage + 1)} disabled={safePage === totalPages} className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title="Berikutnya">
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button onClick={() => goPage(totalPages)} disabled={safePage === totalPages} className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title="Halaman terakhir">
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Alumni Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => !addSaving && setShowAddModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-600" />Tambah Alumni Baru
              </h3>
              <button onClick={() => { setShowAddModal(false); resetAddForm(); }} disabled={addSaving} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Nama <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={addForm.nama}
                  onChange={(e) => setAddForm((f) => ({ ...f, nama: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC]"
                  placeholder="Nama lengkap alumni"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Angkatan <span className="text-red-500">*</span></label>
                  <select
                    value={addForm.angkatan}
                    onChange={(e) => setAddForm((f) => ({ ...f, angkatan: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC]"
                  >
                    <option value="">Pilih TN</option>
                    {Array.from({ length: 35 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>TN {n}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">No. SIS</label>
                  <input
                    type="text"
                    value={addForm.nosis}
                    onChange={(e) => setAddForm((f) => ({ ...f, nosis: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC]"
                    placeholder="Nomor SIS"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Kelanjutan Studi</label>
                  <input
                    type="text"
                    value={addForm.kelanjutan_studi}
                    onChange={(e) => setAddForm((f) => ({ ...f, kelanjutan_studi: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC]"
                    placeholder="Universitas / Sekolah"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Program Studi</label>
                  <input
                    type="text"
                    value={addForm.program_studi}
                    onChange={(e) => setAddForm((f) => ({ ...f, program_studi: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC]"
                    placeholder="Jurusan"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Keterangan</label>
                <input
                  type="text"
                  value={addForm.keterangan}
                  onChange={(e) => setAddForm((f) => ({ ...f, keterangan: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC]"
                  placeholder="Catatan tambahan"
                />
              </div>
            </div>

            <div className="px-5 py-3 border-t border-border flex items-center justify-end gap-2 bg-gray-50/50">
              <button onClick={() => { setShowAddModal(false); resetAddForm(); }} disabled={addSaving} className="px-4 py-2 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                Batal
              </button>
              <button onClick={handleAddAlumni} disabled={addSaving || !addForm.nama.trim() || !addForm.angkatan} className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50">
                {addSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Tambah Alumni
              </button>
            </div>
          </div>
        </div>
      )}

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
                          const isRelinking = relinkCandidateId === candidate.member_id;
                          return (
                            <div key={candidate.member_id} className={`transition-colors ${isSelected ? "bg-blue-50/40" : "hover:bg-gray-50"}`}>
                              <div className="flex items-center gap-3 px-5 py-3">
                                <input type="checkbox" checked={isSelected} onChange={() => togglePair(candidate.member_id)} className="rounded border-gray-300 text-[#0B27BC] focus:ring-[#0B27BC]/20 shrink-0 cursor-pointer" />
                                <div className="flex-1 min-w-0">
                                  <div className="grid grid-cols-[1fr_auto_1fr_auto] gap-2 items-center">
                                    <div className="min-w-0">
                                      <span className="text-sm font-medium text-foreground block truncate">{candidate.member_nama}</span>
                                      <span className="text-xs text-muted-foreground">TN{candidate.member_angkatan}</span>
                                    </div>
                                    <span className="text-xs text-gray-400">&rarr;</span>
                                    <div className="min-w-0">
                                      <span className="text-sm text-[#0B27BC] font-medium block truncate">{candidate.alumni_nama}</span>
                                      <span className="text-xs text-muted-foreground">TN{candidate.alumni_angkatan}</span>
                                    </div>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (isRelinking) {
                                          setRelinkCandidateId(null);
                                          setRelinkQuery("");
                                          setRelinkSearchResults([]);
                                        } else {
                                          setRelinkCandidateId(candidate.member_id);
                                          setRelinkQuery("");
                                          setRelinkSearchResults([]);
                                        }
                                      }}
                                      className="text-[10px] px-2 py-1 rounded-md border border-gray-200 text-gray-500 hover:text-[#0B27BC] hover:border-[#0B27BC]/30 hover:bg-[#0B27BC]/5 transition-colors shrink-0"
                                      title="Ganti alumni secara manual"
                                    >
                                      {isRelinking ? "Batal" : "Ganti"}
                                    </button>
                                  </div>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${candidate.similarity >= 85 ? "bg-emerald-100 text-emerald-700" : candidate.similarity >= 70 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                                      {candidate.similarity}% cocok
                                    </span>
                                  </div>
                                </div>
                              </div>
                              {/* Manual relink search */}
                              {isRelinking && (
                                <div className="px-5 pb-3 ml-7">
                                  <div className="bg-gray-50 rounded-lg p-3 border border-border">
                                    <div className="relative">
                                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                                      <input
                                        type="text"
                                        value={relinkQuery}
                                        onChange={(e) => handleAutoLinkRelinkSearch(e.target.value, candidate.member_angkatan)}
                                        placeholder={`Cari alumni TN${candidate.member_angkatan}...`}
                                        className="w-full pl-8 pr-3 py-1.5 text-sm border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC] bg-white"
                                        autoFocus
                                      />
                                      {relinkSearching && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                                    </div>
                                    {relinkSearchResults.length > 0 && (
                                      <div className="mt-2 divide-y divide-border rounded-md border border-border bg-white overflow-hidden max-h-[200px] overflow-y-auto">
                                        {relinkSearchResults.map((alumni) => (
                                          <button
                                            key={alumni.id}
                                            onClick={() => handleRelinkSelect(candidate.member_id, alumni)}
                                            className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-[#0B27BC]/5 transition-colors"
                                          >
                                            <GraduationCap className="w-3.5 h-3.5 text-[#0B27BC] shrink-0" />
                                            <span className="text-sm font-medium text-foreground truncate">{alumni.nama}</span>
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 shrink-0">TN{alumni.angkatan}</span>
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                    {relinkQuery.length >= 2 && !relinkSearching && relinkSearchResults.length === 0 && (
                                      <p className="text-xs text-muted-foreground mt-2 text-center">Tidak ditemukan alumni yang cocok</p>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
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
