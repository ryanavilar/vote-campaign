"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, Search, X, GraduationCap } from "lucide-react";
import type { Member, Alumni } from "@/lib/types";

interface MemberFormProps {
  member?: Member;
  allMembers?: Member[];
  onSave: (data: Partial<Member>) => void;
  onCancel: () => void;
}

const angkatanOptions = Array.from({ length: 35 }, (_, i) => i + 1);

interface AlumniSearchResult extends Alumni {
  members?: { id: string; no: number }[] | null;
}

export function MemberForm({ member, allMembers, onSave, onCancel }: MemberFormProps) {
  const [nama, setNama] = useState(member?.nama || "");
  const [angkatan, setAngkatan] = useState<number>(member?.angkatan || 1);
  const [noHp, setNoHp] = useState(member?.no_hp || "");
  const [pic, setPic] = useState(member?.pic || "");
  const [referralName, setReferralName] = useState(member?.referral_name || "");
  const [alumniId, setAlumniId] = useState<string | null>(member?.alumni_id || null);
  const [loading, setLoading] = useState(false);

  // Alumni search state (only for creating new members)
  const [alumniSearch, setAlumniSearch] = useState("");
  const [alumniResults, setAlumniResults] = useState<AlumniSearchResult[]>([]);
  const [alumniLoading, setAlumniLoading] = useState(false);
  const [showAlumniDropdown, setShowAlumniDropdown] = useState(false);
  const [selectedAlumni, setSelectedAlumni] = useState<AlumniSearchResult | null>(null);
  const alumniDropdownRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isCreating = !member;

  // Debounced alumni search
  const searchAlumni = useCallback(async (query: string) => {
    if (query.length < 2) {
      setAlumniResults([]);
      setShowAlumniDropdown(false);
      return;
    }

    setAlumniLoading(true);
    try {
      const res = await fetch(
        `/api/alumni?search=${encodeURIComponent(query)}&limit=10&linked=false`
      );
      if (res.ok) {
        const data = await res.json();
        setAlumniResults(data.data || []);
        setShowAlumniDropdown(true);
      }
    } catch {
      // silently fail
    } finally {
      setAlumniLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isCreating) return;
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (alumniSearch.length < 2) {
      setAlumniResults([]);
      setShowAlumniDropdown(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchAlumni(alumniSearch);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [alumniSearch, searchAlumni, isCreating]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (alumniDropdownRef.current && !alumniDropdownRef.current.contains(e.target as Node)) {
        setShowAlumniDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectAlumni = (alumni: AlumniSearchResult) => {
    setSelectedAlumni(alumni);
    setAlumniId(alumni.id);
    setNama(alumni.nama);
    setAngkatan(alumni.angkatan);
    setAlumniSearch("");
    setShowAlumniDropdown(false);
  };

  const handleClearAlumni = () => {
    setSelectedAlumni(null);
    setAlumniId(null);
    setNama("");
    setAngkatan(1);
    setAlumniSearch("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nama.trim()) return;

    setLoading(true);
    try {
      await onSave({
        ...(member ? { id: member.id } : {}),
        nama: nama.trim(),
        angkatan,
        no_hp: noHp.trim(),
        pic: pic.trim() || null,
        referral_name: referralName.trim() || null,
        ...(alumniId ? { alumni_id: alumniId } : {}),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-border p-4 sm:p-6 space-y-4">
      <h3 className="font-semibold text-foreground">
        {member ? "Edit Anggota" : "Tambah Anggota Baru"}
      </h3>

      {/* Alumni Search — only when creating a new member */}
      {isCreating && (
        <div ref={alumniDropdownRef} className="relative">
          <label className="block text-sm font-medium text-foreground mb-1">
            <div className="flex items-center gap-1.5">
              <GraduationCap className="w-4 h-4 text-[#0B27BC]" />
              Cari dari Database Alumni
            </div>
          </label>

          {selectedAlumni ? (
            <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-[#0B27BC]/20 rounded-lg">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {selectedAlumni.nama}
                </p>
                <p className="text-xs text-muted-foreground">
                  TN {selectedAlumni.angkatan}
                  {selectedAlumni.kelanjutan_studi && ` — ${selectedAlumni.kelanjutan_studi}`}
                  {selectedAlumni.program_studi && ` (${selectedAlumni.program_studi})`}
                </p>
              </div>
              <button
                type="button"
                onClick={handleClearAlumni}
                className="p-1 rounded-md hover:bg-blue-100 text-[#0B27BC] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={alumniSearch}
                  onChange={(e) => setAlumniSearch(e.target.value)}
                  onFocus={() => {
                    if (alumniResults.length > 0) setShowAlumniDropdown(true);
                  }}
                  placeholder="Ketik nama alumni (min. 2 huruf)..."
                  className="w-full pl-9 pr-3 py-3 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC]"
                />
                {alumniLoading && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-[#0B27BC]" />
                )}
              </div>

              {showAlumniDropdown && alumniResults.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white rounded-lg border border-border shadow-lg max-h-60 overflow-y-auto">
                  {alumniResults.map((alumni) => (
                    <button
                      key={alumni.id}
                      type="button"
                      onClick={() => handleSelectAlumni(alumni)}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-border last:border-b-0"
                    >
                      <p className="text-sm font-medium text-foreground">{alumni.nama}</p>
                      <p className="text-xs text-muted-foreground">
                        TN {alumni.angkatan}
                        {alumni.kelanjutan_studi && ` — ${alumni.kelanjutan_studi}`}
                        {alumni.program_studi && ` (${alumni.program_studi})`}
                      </p>
                    </button>
                  ))}
                </div>
              )}

              {showAlumniDropdown && alumniSearch.length >= 2 && alumniResults.length === 0 && !alumniLoading && (
                <div className="absolute z-50 w-full mt-1 bg-white rounded-lg border border-border shadow-lg p-4">
                  <p className="text-sm text-muted-foreground text-center">
                    Tidak ditemukan alumni dengan nama tersebut
                  </p>
                </div>
              )}
            </>
          )}

          <p className="text-xs text-muted-foreground mt-1">
            Opsional — pilih alumni untuk mengisi nama & angkatan otomatis, atau isi manual di bawah.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Nama */}
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-foreground mb-1">
            Nama Lengkap <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            placeholder="Masukkan nama lengkap"
            required
            disabled={!!selectedAlumni}
            className="w-full px-4 py-3 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC] disabled:bg-gray-50 disabled:text-gray-500"
          />
        </div>

        {/* Angkatan */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Angkatan <span className="text-red-500">*</span>
          </label>
          <select
            value={angkatan}
            onChange={(e) => setAngkatan(Number(e.target.value))}
            disabled={!!selectedAlumni}
            className="w-full px-4 py-3 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC] bg-white disabled:bg-gray-50 disabled:text-gray-500"
          >
            {angkatanOptions.map((a) => (
              <option key={a} value={a}>
                TN {a}
              </option>
            ))}
          </select>
        </div>

        {/* No HP */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            No. HP
          </label>
          <input
            type="tel"
            value={noHp}
            onChange={(e) => setNoHp(e.target.value)}
            placeholder="08xxxxxxxxxx"
            className="w-full px-4 py-3 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC]"
          />
        </div>

        {/* PIC */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            PIC (Penanggung Jawab)
          </label>
          <input
            type="text"
            value={pic}
            onChange={(e) => setPic(e.target.value)}
            placeholder="Nama PIC"
            className="w-full px-4 py-3 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC]"
          />
        </div>

        {/* Referral Name */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Direferensikan Oleh
          </label>
          <input
            type="text"
            value={referralName}
            onChange={(e) => setReferralName(e.target.value)}
            placeholder="Ketik nama yang mereferensikan"
            className="w-full px-4 py-3 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC]"
          />
        </div>
      </div>

      {/* Buttons */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={loading || !nama.trim()}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-[#0B27BC] rounded-lg hover:bg-[#091fa0] transition-colors disabled:opacity-50"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {member ? "Simpan Perubahan" : "Tambah Anggota"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          Batal
        </button>
      </div>
    </form>
  );
}
