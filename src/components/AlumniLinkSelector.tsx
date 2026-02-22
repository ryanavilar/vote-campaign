"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, Search, X, GraduationCap, Unlink } from "lucide-react";
import type { Alumni } from "@/lib/types";

interface AlumniSearchResult extends Alumni {
  members?: { id: string }[] | null;
}

interface AlumniLinkSelectorProps {
  /** Current alumni_id of the member (null if not linked) */
  currentAlumniId: string | null;
  /** Member name for pre-filling search */
  memberName?: string;
  /** Member angkatan for pre-selecting batch filter */
  memberAngkatan?: number;
  /** Called when an alumni is selected or unlinked. Passes alumni_id or null. */
  onLink: (alumniId: string | null) => Promise<void>;
  /** Called to close the selector */
  onClose: () => void;
}

export function AlumniLinkSelector({
  currentAlumniId,
  memberName,
  memberAngkatan,
  onLink,
  onClose,
}: AlumniLinkSelectorProps) {
  const [search, setSearch] = useState(memberName || "");
  const [angkatanFilter, setAngkatanFilter] = useState<string>(
    memberAngkatan ? String(memberAngkatan) : ""
  );
  const [results, setResults] = useState<AlumniSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const searchAlumni = useCallback(async (query: string, angkatan: string) => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      let url = `/api/alumni?search=${encodeURIComponent(query)}&limit=15`;
      if (angkatan) {
        url += `&angkatan=${angkatan}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setResults(data.data || []);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search — triggers on search text or angkatan filter change
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (search.length < 2) {
      setResults([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchAlumni(search, angkatanFilter);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [search, angkatanFilter, searchAlumni]);

  // Auto-focus input
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // Initial search with member name
  useEffect(() => {
    if (memberName && memberName.length >= 2) {
      searchAlumni(memberName, angkatanFilter);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelect = async (alumni: AlumniSearchResult) => {
    setLinking(true);
    try {
      await onLink(alumni.id);
    } finally {
      setLinking(false);
    }
  };

  const handleUnlink = async () => {
    setLinking(true);
    try {
      await onLink(null);
    } finally {
      setLinking(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !linking) onClose();
      }}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-[#0B27BC]/5">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-[#0B27BC]" />
            <h3 className="font-semibold text-sm text-foreground">
              Hubungkan dengan Alumni
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={linking}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Current link status */}
        {currentAlumniId && (
          <div className="px-4 py-2.5 border-b border-border bg-emerald-50/50 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 shrink-0">
                <GraduationCap className="w-3 h-3" />
              </span>
              <span className="text-xs text-emerald-700 font-medium truncate">
                Saat ini terhubung dengan alumni
              </span>
            </div>
            <button
              onClick={handleUnlink}
              disabled={linking}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 transition-colors disabled:opacity-50 shrink-0"
            >
              {linking ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Unlink className="w-3 h-3" />
              )}
              Putuskan
            </button>
          </div>
        )}

        {/* Search + Angkatan filter */}
        <div className="px-4 py-3 border-b border-border">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama alumni..."
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC]"
              />
              {loading && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-[#0B27BC]" />
              )}
            </div>
            <select
              value={angkatanFilter}
              onChange={(e) => setAngkatanFilter(e.target.value)}
              className="px-2 py-2.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC] bg-white shrink-0 w-[90px]"
            >
              <option value="">Semua</option>
              {Array.from({ length: 35 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  TN {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {linking ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-[#0B27BC]" />
              <p className="text-sm text-muted-foreground">Menghubungkan...</p>
            </div>
          ) : results.length > 0 ? (
            <div className="divide-y divide-border">
              {results.map((alumni) => {
                const isCurrentlyLinked = alumni.id === currentAlumniId;
                const hasOtherMember = alumni.members && alumni.members.length > 0 && !isCurrentlyLinked;

                return (
                  <button
                    key={alumni.id}
                    type="button"
                    onClick={() => !isCurrentlyLinked && handleSelect(alumni)}
                    disabled={isCurrentlyLinked}
                    className={`w-full px-4 py-3 text-left transition-colors ${
                      isCurrentlyLinked
                        ? "bg-emerald-50/50 cursor-default"
                        : "hover:bg-gray-50 cursor-pointer"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {alumni.nama}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          TN {alumni.angkatan}
                          {alumni.kelanjutan_studi && ` — ${alumni.kelanjutan_studi}`}
                          {alumni.program_studi && ` (${alumni.program_studi})`}
                        </p>
                      </div>
                      {isCurrentlyLinked && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium shrink-0">
                          Terhubung
                        </span>
                      )}
                      {hasOtherMember && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium shrink-0">
                          Sudah ada anggota
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : search.length >= 2 && !loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <GraduationCap className="w-8 h-8 text-gray-300" />
              <p className="text-sm text-muted-foreground">
                Tidak ditemukan alumni dengan nama tersebut
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Search className="w-8 h-8 text-gray-300" />
              <p className="text-sm text-muted-foreground">
                Ketik nama alumni untuk mencari
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
