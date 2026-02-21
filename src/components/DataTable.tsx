"use client";

import type { Member, StatusValue } from "@/lib/types";
import { formatNum } from "@/lib/format";
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ChevronsUpDown, X, Merge, Loader2, ArrowRight } from "lucide-react";
import { useState, useMemo } from "react";

interface DataTableProps {
  data: Member[];
  allData?: Member[];
  attendanceCounts?: Record<string, number>;
  onUpdate?: (id: string, field: string, value: StatusValue) => void;
  onRowClick?: (id: string) => void;
  totalCount: number;
  onDataRefresh?: () => void;
}

const PAGE_SIZE = 25;

function StatusBadge({
  value,
  onChange,
}: {
  value: StatusValue;
  onChange?: (v: StatusValue) => void;
}) {
  const colors = {
    Sudah: "bg-emerald-100 text-emerald-700 border-emerald-200",
    Belum: "bg-red-100 text-red-700 border-red-200",
  };

  const colorClass = value ? colors[value] : "bg-gray-50 text-gray-400 border-gray-200";

  if (!onChange) {
    return (
      <span className={`text-xs font-medium px-2 py-1 rounded-md border inline-block ${colorClass}`}>
        {value || "-"}
      </span>
    );
  }

  return (
    <select
      value={value || ""}
      onChange={(e) => onChange((e.target.value || null) as StatusValue)}
      onClick={(e) => e.stopPropagation()}
      className={`text-xs font-medium px-2 py-1 rounded-md border cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#0B27BC]/30 ${colorClass}`}
    >
      <option value="">-</option>
      <option value="Sudah">Sudah</option>
      <option value="Belum">Belum</option>
    </select>
  );
}

type SortKey = "no" | "nama" | "angkatan" | "no_hp" | "kegiatan" | "status_dpt" | "sudah_dikontak" | "masuk_grup" | "vote";
type SortDir = "asc" | "desc";

function SortHeader({
  label,
  sortKey,
  currentKey,
  currentDir,
  onSort,
  align = "left",
  className = "",
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey | null;
  currentDir: SortDir;
  onSort: (key: SortKey) => void;
  align?: "left" | "center";
  className?: string;
}) {
  const active = currentKey === sortKey;
  return (
    <th
      onClick={() => onSort(sortKey)}
      className={`px-3 py-2.5 font-semibold text-xs text-[#0B27BC]/70 uppercase tracking-wider cursor-pointer select-none hover:text-[#0B27BC] transition-colors ${align === "center" ? "text-center" : "text-left"} ${className}`}
    >
      <span className="inline-flex items-center gap-0.5">
        {label}
        {active ? (
          currentDir === "asc" ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )
        ) : (
          <ChevronsUpDown className="w-3 h-3 opacity-30" />
        )}
      </span>
    </th>
  );
}

/* ------------------------------------------------------------------ */
/* Merge UI Component                                                  */
/* ------------------------------------------------------------------ */

const MERGE_FIELDS: { key: string; label: string }[] = [
  { key: "nama", label: "Nama" },
  { key: "angkatan", label: "Angkatan" },
  { key: "no_hp", label: "No. HP" },
  { key: "pic", label: "PIC" },
  { key: "email", label: "Email" },
  { key: "domisili", label: "Domisili" },
  { key: "status_dpt", label: "Status DPT" },
  { key: "sudah_dikontak", label: "Sudah Dikontak" },
  { key: "masuk_grup", label: "Masuk Grup" },
  { key: "vote", label: "Vote" },
  { key: "referral_name", label: "Referral" },
  { key: "alumni_id", label: "Link Alumni" },
];

function MergeView({
  memberA,
  memberB,
  onConfirm,
  onCancel,
}: {
  memberA: Member;
  memberB: Member;
  onConfirm: (winnerId: string, loserId: string, fields: Record<string, "winner" | "loser">) => void;
  onCancel: () => void;
}) {
  // "winner" = left (memberA), "loser" = right (memberB)
  const [picks, setPicks] = useState<Record<string, "winner" | "loser">>(() => {
    const initial: Record<string, "winner" | "loser"> = {};
    for (const { key } of MERGE_FIELDS) {
      // Default: pick the value that is non-null/non-empty; if both have values, pick winner (left)
      const aVal = (memberA as unknown as Record<string, unknown>)[key];
      const bVal = (memberB as unknown as Record<string, unknown>)[key];
      if (!aVal && bVal) {
        initial[key] = "loser";
      } else {
        initial[key] = "winner";
      }
    }
    return initial;
  });

  const displayVal = (val: unknown) => {
    if (val === null || val === undefined || val === "") return <span className="text-gray-300 italic">kosong</span>;
    return String(val);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Merge className="w-4 h-4 text-[#0B27BC]" />
          Merge Data
        </h4>
        <p className="text-xs text-muted-foreground">Pilih nilai yang ingin dipertahankan</p>
      </div>

      {/* Header row */}
      <div className="grid grid-cols-[120px_1fr_32px_1fr] gap-2 px-2 text-xs font-semibold text-muted-foreground">
        <div>Field</div>
        <div className="text-center">#{memberA.no} {memberA.nama}</div>
        <div />
        <div className="text-center">#{memberB.no} {memberB.nama}</div>
      </div>

      {/* Field rows */}
      <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
        {MERGE_FIELDS.map(({ key, label }) => {
          const aVal = (memberA as unknown as Record<string, unknown>)[key];
          const bVal = (memberB as unknown as Record<string, unknown>)[key];
          const same = String(aVal || "") === String(bVal || "");
          const pick = picks[key];

          return (
            <div key={key} className={`grid grid-cols-[120px_1fr_32px_1fr] gap-2 px-2 py-2 items-center text-xs ${same ? "bg-gray-50/50" : ""}`}>
              <div className="font-medium text-gray-600">{label}</div>
              <button
                type="button"
                onClick={() => setPicks((p) => ({ ...p, [key]: "winner" }))}
                className={`px-2 py-1.5 rounded-md text-left truncate transition-colors ${
                  pick === "winner"
                    ? "bg-[#0B27BC]/10 text-[#0B27BC] ring-1 ring-[#0B27BC]/30 font-medium"
                    : "hover:bg-gray-100 text-gray-600"
                }`}
              >
                {displayVal(aVal)}
              </button>
              <div className="flex items-center justify-center">
                <ArrowRight className="w-3 h-3 text-gray-300" />
              </div>
              <button
                type="button"
                onClick={() => setPicks((p) => ({ ...p, [key]: "loser" }))}
                className={`px-2 py-1.5 rounded-md text-left truncate transition-colors ${
                  pick === "loser"
                    ? "bg-[#84303F]/10 text-[#84303F] ring-1 ring-[#84303F]/30 font-medium"
                    : "hover:bg-gray-100 text-gray-600"
                }`}
              >
                {displayVal(bVal)}
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-2">
        <p className="text-xs text-muted-foreground">
          #{memberB.no} akan dihapus setelah merge
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => onConfirm(memberA.id, memberB.id, picks)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#0B27BC] rounded-lg hover:bg-[#091fa0] transition-colors"
          >
            <Merge className="w-3.5 h-3.5" />
            Konfirmasi Merge
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main DataTable                                                      */
/* ------------------------------------------------------------------ */

export function DataTable({ data, allData, attendanceCounts, onUpdate, onRowClick, totalCount, onDataRefresh }: DataTableProps) {
  const [page, setPage] = useState(0);
  const [duplicateModalPhone, setDuplicateModalPhone] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Merge state
  const [mergeMembers, setMergeMembers] = useState<[Member, Member] | null>(null);
  const [merging, setMerging] = useState(false);
  const [mergeToast, setMergeToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      if (sortDir === "asc") {
        setSortDir("desc");
      } else {
        // Third click resets to default
        setSortKey(null);
        setSortDir("asc");
      }
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(0);
  }

  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      let aVal: string | number | null;
      let bVal: string | number | null;

      if (sortKey === "kegiatan") {
        aVal = attendanceCounts?.[a.id] ?? 0;
        bVal = attendanceCounts?.[b.id] ?? 0;
      } else if (sortKey === "no" || sortKey === "angkatan") {
        aVal = a[sortKey];
        bVal = b[sortKey];
      } else {
        aVal = a[sortKey] ?? "";
        bVal = b[sortKey] ?? "";
      }

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      }
      const strA = String(aVal).toLowerCase();
      const strB = String(bVal).toLowerCase();
      const cmp = strA.localeCompare(strB);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir, attendanceCounts]);

  const totalPages = Math.ceil(sortedData.length / PAGE_SIZE);
  const pageData = sortedData.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Compute duplicate phone map across ALL data (not just filtered/paginated)
  const sourceData = allData || data;
  const duplicatePhones = useMemo(() => {
    const phoneMap = new Map<string, Member[]>();
    for (const m of sourceData) {
      const phone = m.no_hp?.trim();
      if (!phone) continue;
      const existing = phoneMap.get(phone);
      if (existing) {
        existing.push(m);
      } else {
        phoneMap.set(phone, [m]);
      }
    }
    // Only keep entries with more than 1 member
    const result = new Map<string, Member[]>();
    for (const [phone, members] of phoneMap) {
      if (members.length > 1) {
        result.set(phone, members);
      }
    }
    return result;
  }, [sourceData]);

  const modalMembers = duplicateModalPhone ? duplicatePhones.get(duplicateModalPhone) || [] : [];

  const handleStartMerge = (a: Member, b: Member) => {
    setMergeMembers([a, b]);
  };

  const handleMergeConfirm = async (winnerId: string, loserId: string, fields: Record<string, "winner" | "loser">) => {
    setMerging(true);
    try {
      const res = await fetch("/api/members/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winner_id: winnerId, loser_id: loserId, fields }),
      });
      const result = await res.json();
      if (res.ok) {
        setMergeToast({ msg: "Berhasil merge data anggota", type: "success" });
        setMergeMembers(null);
        setDuplicateModalPhone(null);
        // Refresh parent data
        onDataRefresh?.();
      } else {
        setMergeToast({ msg: result.error || "Gagal merge", type: "error" });
      }
    } catch {
      setMergeToast({ msg: "Terjadi kesalahan jaringan", type: "error" });
    }
    setMerging(false);
    // Auto-dismiss toast
    setTimeout(() => setMergeToast(null), 3000);
  };

  return (
    <>
      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-foreground text-sm">
            Data Anggota{" "}
            <span className="font-normal text-muted-foreground">
              ({formatNum(data.length)} dari {formatNum(totalCount)})
            </span>
          </h3>
          <div className="flex items-center gap-2 text-sm">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs text-muted-foreground">
              {page + 1} / {Math.max(1, totalPages)}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#0B27BC]/5">
                <SortHeader label="No" sortKey="no" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="left" className="w-10" />
                <SortHeader label="Nama" sortKey="nama" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="left" className="min-w-[180px]" />
                <SortHeader label="TN" sortKey="angkatan" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="center" className="w-20" />
                <SortHeader label="No. HP" sortKey="no_hp" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="left" className="w-[140px]" />
                {attendanceCounts && (
                  <SortHeader label="Kegiatan" sortKey="kegiatan" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="center" className="w-16" />
                )}
                <SortHeader label="Status DPT" sortKey="status_dpt" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="center" className="w-[100px]" />
                <SortHeader label="Dikontak" sortKey="sudah_dikontak" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="center" className="w-[100px]" />
                <SortHeader label="Masuk Grup" sortKey="masuk_grup" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="center" className="w-[100px]" />
                <SortHeader label="Vote" sortKey="vote" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="center" className="w-[100px]" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pageData.map((member) => (
                <tr
                  key={member.id}
                  onClick={onRowClick ? () => onRowClick(member.id) : undefined}
                  className={`hover:bg-[#0B27BC]/[0.02] transition-colors ${onRowClick ? "cursor-pointer" : ""}`}
                >
                  <td className="px-3 py-2 text-muted-foreground">{member.no}</td>
                  <td className="px-3 py-2 font-medium text-foreground">
                    {member.nama}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-[#0B27BC]/10 text-[#0B27BC] text-xs font-medium">
                      TN{member.angkatan}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="text-muted-foreground font-mono text-xs">
                      {member.no_hp}
                    </div>
                    {member.no_hp && duplicatePhones.has(member.no_hp.trim()) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDuplicateModalPhone(member.no_hp.trim());
                        }}
                        className="mt-0.5 inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold rounded bg-[#FE8DA1]/20 text-[#84303F] hover:bg-[#FE8DA1]/30 transition-colors"
                      >
                        Duplikat ({duplicatePhones.get(member.no_hp.trim())!.length})
                      </button>
                    )}
                  </td>
                  {attendanceCounts && (
                    <td className="px-3 py-2 text-center">
                      {attendanceCounts[member.id] ? (
                        <span className="inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
                          {attendanceCounts[member.id]}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">0</span>
                      )}
                    </td>
                  )}
                  <td className="px-3 py-2 text-center">
                    <StatusBadge
                      value={member.status_dpt}
                      onChange={onUpdate ? (v) => onUpdate(member.id, "status_dpt", v) : undefined}
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <StatusBadge
                      value={member.sudah_dikontak}
                      onChange={onUpdate ? (v) => onUpdate(member.id, "sudah_dikontak", v) : undefined}
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <StatusBadge
                      value={member.masuk_grup}
                      onChange={onUpdate ? (v) => onUpdate(member.id, "masuk_grup", v) : undefined}
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <StatusBadge
                      value={member.vote}
                      onChange={onUpdate ? (v) => onUpdate(member.id, "vote", v) : undefined}
                    />
                  </td>
                </tr>
              ))}
              {pageData.length === 0 && (
                <tr>
                  <td colSpan={attendanceCounts ? 9 : 8} className="px-3 py-8 text-center text-muted-foreground">
                    Tidak ada data yang cocok dengan filter
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Duplicate Phone Modal */}
      {duplicateModalPhone && !mergeMembers && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setDuplicateModalPhone(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-[#FE8DA1]/10">
              <div>
                <h3 className="font-semibold text-sm text-foreground">
                  Nomor Duplikat
                </h3>
                <p className="text-xs text-muted-foreground font-mono">
                  {duplicateModalPhone}
                </p>
              </div>
              <button
                onClick={() => setDuplicateModalPhone(null)}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="divide-y divide-border max-h-80 overflow-y-auto">
              {modalMembers.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    setDuplicateModalPhone(null);
                    if (onRowClick) onRowClick(m.id);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="text-xs text-muted-foreground w-8">
                    #{m.no}
                  </span>
                  <span className="text-sm font-medium text-foreground flex-1">
                    {m.nama}
                  </span>
                  <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-[#0B27BC]/10 text-[#0B27BC]">
                    TN{m.angkatan}
                  </span>
                </button>
              ))}
            </div>
            {/* Merge button — only show when exactly 2 duplicates or allow selecting any 2 */}
            {modalMembers.length >= 2 && (
              <div className="px-4 py-3 border-t border-border bg-gray-50/50">
                {modalMembers.length === 2 ? (
                  <button
                    onClick={() => handleStartMerge(modalMembers[0], modalMembers[1])}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium text-white bg-[#84303F] rounded-lg hover:bg-[#6e2835] transition-colors"
                  >
                    <Merge className="w-3.5 h-3.5" />
                    Merge 2 Data
                  </button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground text-center">Pilih 2 data untuk di-merge:</p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {modalMembers.map((a, i) =>
                        modalMembers.slice(i + 1).map((b) => (
                          <button
                            key={`${a.id}-${b.id}`}
                            onClick={() => handleStartMerge(a, b)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#84303F] bg-[#FE8DA1]/10 border border-[#FE8DA1]/30 rounded-lg hover:bg-[#FE8DA1]/20 transition-colors"
                          >
                            <Merge className="w-3 h-3" />
                            #{a.no} & #{b.no}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Merge Modal */}
      {mergeMembers && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => !merging && setMergeMembers(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-5"
            onClick={(e) => e.stopPropagation()}
          >
            {merging ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-[#0B27BC]" />
                <p className="text-sm text-muted-foreground">Sedang merge data...</p>
              </div>
            ) : (
              <MergeView
                memberA={mergeMembers[0]}
                memberB={mergeMembers[1]}
                onConfirm={handleMergeConfirm}
                onCancel={() => setMergeMembers(null)}
              />
            )}
          </div>
        </div>
      )}

      {/* Merge Toast */}
      {mergeToast && (
        <div className={`fixed bottom-4 right-4 z-[60] px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
          mergeToast.type === "success" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
        }`}>
          {mergeToast.msg}
        </div>
      )}
    </>
  );
}
