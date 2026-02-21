"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRole } from "@/lib/RoleContext";
import { useToast } from "@/components/Toast";
import { formatNum } from "@/lib/format";
import {
  Loader2,
  GraduationCap,
  Search,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  AlertTriangle,
  Link2,
  Check,
  X,
  Save,
  Phone,
  User,
  CheckCircle2,
  HelpCircle,
  Unlink,
} from "lucide-react";
import type { Alumni } from "@/lib/types";

interface MemberInfo {
  id: string;
  no: number;
  no_hp?: string | null;
  pic?: string | null;
  status_dpt?: string | null;
  sudah_dikontak?: string | null;
  masuk_grup?: string | null;
  vote?: string | null;
}

interface AlumniWithMember extends Alumni {
  members: MemberInfo[] | null;
}

interface EditForm {
  no_hp: string;
  pic: string;
  status_dpt: string;
  sudah_dikontak: string;
  masuk_grup: string;
  vote: string;
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

export default function AdminAlumniPage() {
  const { canManageUsers, loading: roleLoading } = useRole();
  const { showToast } = useToast();

  const [alumni, setAlumni] = useState<AlumniWithMember[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [search, setSearch] = useState("");
  const [filterAngkatan, setFilterAngkatan] = useState("all");
  const [filterLinked, setFilterLinked] = useState("all");
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);

  // Inline edit state
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    no_hp: "",
    pic: "",
    status_dpt: "",
    sudah_dikontak: "",
    masuk_grup: "",
    vote: "",
  });
  const [saving, setSaving] = useState(false);

  // Auto-link modal state
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkConfirming, setLinkConfirming] = useState(false);
  const [linkPreview, setLinkPreview] = useState<PreviewResult | null>(null);
  const [linkTab, setLinkTab] = useState<LinkTab>("certain");
  const [selectedPairs, setSelectedPairs] = useState<Set<string>>(new Set());

  const fetchAlumni = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (filterAngkatan !== "all") params.set("angkatan", filterAngkatan);
    if (filterLinked !== "all") params.set("linked", filterLinked);
    params.set("page", String(page));
    params.set("limit", String(limit));

    try {
      const res = await fetch(`/api/alumni?${params}`);
      const data = await res.json();
      setAlumni(data.data || []);
      setTotal(data.total || 0);
      setTotalLinked(data.totalLinked || 0);
    } catch {
      showToast("Gagal memuat data alumni", "error");
    }
    setLoading(false);
  }, [search, filterAngkatan, filterLinked, page, limit, showToast]);

  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filterAngkatan, filterLinked]);

  useEffect(() => {
    if (!roleLoading && canManageUsers) {
      fetchAlumni();
    } else if (!roleLoading && !canManageUsers) {
      setLoading(false);
    }
  }, [roleLoading, canManageUsers, debouncedSearch, filterAngkatan, filterLinked, page, fetchAlumni]);

  const [totalLinked, setTotalLinked] = useState(0);

  const totalPages = Math.ceil(total / limit);

  // ---- Auto-link preview ----
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
        showToast(
          `${result.linked} anggota berhasil dihubungkan${result.failed > 0 ? `. ${result.failed} gagal.` : "."}`,
          "success"
        );
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
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
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
        if (allSelected) next.delete(c.member_id);
        else next.add(c.member_id);
      }
      return next;
    });
  };

  // ---- Tambah & Edit ----
  const handleAddToCampaign = async (alumniItem: AlumniWithMember) => {
    if (addingId) return;
    setAddingId(alumniItem.id);
    try {
      const res = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nama: alumniItem.nama,
          angkatan: alumniItem.angkatan,
          alumni_id: alumniItem.id,
        }),
      });
      if (res.ok) {
        showToast(`${alumniItem.nama} ditambahkan ke kampanye`, "success");
        fetchAlumni();
      } else {
        const result = await res.json();
        showToast(result.error || "Gagal menambahkan", "error");
      }
    } catch {
      showToast("Terjadi kesalahan jaringan", "error");
    }
    setAddingId(null);
  };

  const startEditing = (member: MemberInfo) => {
    setEditingMemberId(member.id);
    setEditForm({
      no_hp: member.no_hp || "",
      pic: member.pic || "",
      status_dpt: member.status_dpt || "Belum",
      sudah_dikontak: member.sudah_dikontak || "Belum",
      masuk_grup: member.masuk_grup || "Belum",
      vote: member.vote || "Belum",
    });
  };

  const cancelEditing = () => setEditingMemberId(null);

  const saveEditing = async () => {
    if (!editingMemberId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/members/${editingMemberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          no_hp: editForm.no_hp.trim() || null,
          pic: editForm.pic.trim() || null,
          status_dpt: editForm.status_dpt,
          sudah_dikontak: editForm.sudah_dikontak,
          masuk_grup: editForm.masuk_grup,
          vote: editForm.vote,
        }),
      });
      if (res.ok) {
        showToast("Data anggota berhasil diperbarui", "success");
        setEditingMemberId(null);
        fetchAlumni();
      } else {
        const result = await res.json();
        showToast(result.error || "Gagal menyimpan", "error");
      }
    } catch {
      showToast("Terjadi kesalahan jaringan", "error");
    }
    setSaving(false);
  };

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

  if (!canManageUsers) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-center px-4">
          <div className="p-3 rounded-full bg-red-100">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Akses Ditolak</h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            Anda tidak memiliki izin untuk mengakses halaman ini. Hanya admin yang dapat mengelola database alumni.
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
                <p className="text-xs text-white/70">Database alumni SMA Taruna Nusantara</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleAutoLinkPreview}
                disabled={showLinkModal}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-[#84303F] rounded-lg hover:bg-[#6e2835] transition-colors disabled:opacity-50"
              >
                <Link2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Auto-Link</span>
                <span className="sm:hidden">Link</span>
              </button>
            </div>
          </div>
        </div>
        <div className="h-1 bg-gradient-to-r from-[#fcb7c3] via-[#FE8DA1] to-[#fcb7c3]" />
      </header>

      <div className="px-4 sm:px-6 py-6 space-y-4">
        {/* Stats bar */}
        <div className="bg-white rounded-xl border border-border shadow-sm p-4 flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#0B27BC]/10">
              <GraduationCap className="w-5 h-5 text-[#0B27BC]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{formatNum(total)}</p>
              <p className="text-xs text-muted-foreground">Total Alumni</p>
            </div>
          </div>
          <div className="h-8 w-px bg-border" />
          <div>
            <p className="text-2xl font-bold text-emerald-600">{formatNum(totalLinked)}</p>
            <p className="text-xs text-muted-foreground">Terhubung Kampanye</p>
          </div>
        </div>

        {/* Filter bar */}
        <div className="bg-white rounded-xl border border-border shadow-sm p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama alumni..." className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC] bg-white" />
            </div>
            <select value={filterAngkatan} onChange={(e) => setFilterAngkatan(e.target.value)} className="px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC] bg-white">
              <option value="all">Semua Angkatan</option>
              {Array.from({ length: 35 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={String(n)}>TN {n}</option>
              ))}
            </select>
            <select value={filterLinked} onChange={(e) => setFilterLinked(e.target.value)} className="px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC] bg-white">
              <option value="all">Semua Status</option>
              <option value="true">Terhubung Kampanye</option>
              <option value="false">Belum Terhubung</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-gray-50/80">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 w-12">#</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">NOSIS</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Nama</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">TN</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">Kelanjutan Studi</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden lg:table-cell">Program Studi</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-6 h-6 animate-spin text-[#0B27BC]" />
                        <p className="text-sm text-muted-foreground">Memuat data alumni...</p>
                      </div>
                    </td>
                  </tr>
                ) : alumni.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <GraduationCap className="w-8 h-8 text-gray-300" />
                        <p className="text-sm text-muted-foreground">
                          {search || filterAngkatan !== "all" || filterLinked !== "all"
                            ? "Tidak ada alumni yang cocok dengan filter"
                            : "Belum ada data alumni."}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  alumni.map((item, index) => {
                    const isLinked = item.members && item.members.length > 0;
                    const member = isLinked ? item.members![0] : null;
                    const isEditing = member && editingMemberId === member.id;
                    const isAdding = addingId === item.id;

                    return (
                      <React.Fragment key={item.id}>
                        <tr
                          className={`border-b border-border last:border-b-0 transition-colors ${isEditing ? "bg-blue-50/60" : isLinked ? "hover:bg-gray-50 cursor-pointer" : "hover:bg-gray-50"}`}
                          onClick={() => { if (isLinked && member && !isEditing) startEditing(member); }}
                        >
                          <td className="px-4 py-3 text-gray-500">{(page - 1) * limit + index + 1}</td>
                          <td className="px-4 py-3"><span className="text-gray-500 font-mono text-xs">{item.nosis || "-"}</span></td>
                          <td className="px-4 py-3"><span className="font-medium text-foreground">{item.nama}</span></td>
                          <td className="px-4 py-3"><span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium bg-[#0B27BC]/10 text-[#0B27BC]">TN{item.angkatan}</span></td>
                          <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{item.kelanjutan_studi || "-"}</td>
                          <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">{item.program_studi || "-"}</td>
                          <td className="px-4 py-3">
                            {isLinked ? (
                              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-700">
                                <Check className="w-3 h-3" />Anggota
                              </span>
                            ) : (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleAddToCampaign(item); }}
                                disabled={isAdding || !!addingId}
                                className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium border border-[#0B27BC]/30 text-[#0B27BC] hover:bg-[#0B27BC]/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {isAdding ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />}
                                Tambah
                              </button>
                            )}
                          </td>
                        </tr>

                        {isEditing && member && (
                          <tr className="bg-blue-50/40">
                            <td colSpan={7} className="px-4 py-4">
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                    <User className="w-4 h-4 text-[#0B27BC]" />
                                    Edit Data Anggota — {item.nama}
                                  </h4>
                                  <button type="button" onClick={(e) => { e.stopPropagation(); cancelEditing(); }} className="p-1 rounded-md hover:bg-gray-200 text-gray-500 transition-colors">
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                  <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1"><Phone className="w-3 h-3 inline mr-1" />No. HP</label>
                                    <input type="tel" value={editForm.no_hp} onChange={(e) => setEditForm((f) => ({ ...f, no_hp: e.target.value }))} onClick={(e) => e.stopPropagation()} placeholder="08xxxxxxxxxx" className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC] bg-white" />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1"><User className="w-3 h-3 inline mr-1" />PIC</label>
                                    <input type="text" value={editForm.pic} onChange={(e) => setEditForm((f) => ({ ...f, pic: e.target.value }))} onClick={(e) => e.stopPropagation()} placeholder="Nama PIC" className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC] bg-white" />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Status DPT</label>
                                    <select value={editForm.status_dpt} onChange={(e) => setEditForm((f) => ({ ...f, status_dpt: e.target.value }))} onClick={(e) => e.stopPropagation()} className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC] bg-white"><option value="Belum">Belum</option><option value="Sudah">Sudah</option></select>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Sudah Dikontak</label>
                                    <select value={editForm.sudah_dikontak} onChange={(e) => setEditForm((f) => ({ ...f, sudah_dikontak: e.target.value }))} onClick={(e) => e.stopPropagation()} className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC] bg-white"><option value="Belum">Belum</option><option value="Sudah">Sudah</option></select>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Masuk Grup</label>
                                    <select value={editForm.masuk_grup} onChange={(e) => setEditForm((f) => ({ ...f, masuk_grup: e.target.value }))} onClick={(e) => e.stopPropagation()} className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC] bg-white"><option value="Belum">Belum</option><option value="Sudah">Sudah</option></select>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Vote</label>
                                    <select value={editForm.vote} onChange={(e) => setEditForm((f) => ({ ...f, vote: e.target.value }))} onClick={(e) => e.stopPropagation()} className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC] bg-white"><option value="Belum">Belum</option><option value="Sudah">Sudah</option></select>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 pt-1">
                                  <button type="button" onClick={(e) => { e.stopPropagation(); saveEditing(); }} disabled={saving} className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#0B27BC] rounded-lg hover:bg-[#091fa0] transition-colors disabled:opacity-50">
                                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                    Simpan
                                  </button>
                                  <button type="button" onClick={(e) => { e.stopPropagation(); cancelEditing(); }} className="px-4 py-2 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Batal</button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-gray-50/50">
              <p className="text-sm text-muted-foreground">Halaman {page} dari {formatNum(totalPages)}</p>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  <ChevronLeft className="w-3.5 h-3.5" />Sebelumnya
                </button>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  Berikutnya<ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Auto-Link Preview Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => !linkLoading && !linkConfirming && setShowLinkModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Modal header */}
            <div className="px-5 py-4 border-b border-border flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-[#0B27BC]" />
                  Auto-Link Preview
                </h3>
                {linkPreview && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatNum(linkPreview.total_unlinked)} anggota belum terhubung
                    {linkPreview.total_no_match > 0 && (
                      <span className="ml-1">&middot; {formatNum(linkPreview.total_no_match)} tidak ditemukan kecocokan</span>
                    )}
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
                {/* Tabs */}
                <div className="flex border-b border-border shrink-0">
                  <button onClick={() => setLinkTab("certain")} className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${linkTab === "certain" ? "text-emerald-700 border-b-2 border-emerald-500 bg-emerald-50/50" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}>
                    <CheckCircle2 className="w-4 h-4" />
                    Pasti ({formatNum(certainCandidates.length)})
                  </button>
                  <button onClick={() => setLinkTab("uncertain")} className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${linkTab === "uncertain" ? "text-amber-700 border-b-2 border-amber-500 bg-amber-50/50" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}>
                    <HelpCircle className="w-4 h-4" />
                    Tidak Pasti ({formatNum(uncertainCandidates.length)})
                  </button>
                </div>

                {/* Select all */}
                {currentTabCandidates.length > 0 && (
                  <div className="px-5 py-2 border-b border-border flex items-center justify-between bg-gray-50/50 shrink-0">
                    <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                      <input type="checkbox" checked={currentTabCandidates.every((c) => selectedPairs.has(c.member_id))} onChange={() => toggleAllInTab(linkTab)} className="rounded border-gray-300 text-[#0B27BC] focus:ring-[#0B27BC]/20" />
                      Pilih semua {linkTab === "certain" ? "pasti" : "tidak pasti"}
                    </label>
                    <span className="text-xs text-muted-foreground">
                      {currentTabCandidates.filter((c) => selectedPairs.has(c.member_id)).length} dipilih
                    </span>
                  </div>
                )}

                {/* Candidate list */}
                <div className="flex-1 overflow-y-auto">
                  {currentTabCandidates.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-2">
                      <Unlink className="w-8 h-8 text-gray-300" />
                      <p className="text-sm text-muted-foreground">
                        {linkTab === "certain" ? "Tidak ada kecocokan pasti" : "Tidak ada kecocokan tidak pasti"}
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {currentTabCandidates.map((candidate) => {
                        const isSelected = selectedPairs.has(candidate.member_id);
                        return (
                          <label key={candidate.member_id} className={`flex items-center gap-3 px-5 py-3 cursor-pointer transition-colors ${isSelected ? "bg-blue-50/40" : "hover:bg-gray-50"}`}>
                            <input type="checkbox" checked={isSelected} onChange={() => togglePair(candidate.member_id)} className="rounded border-gray-300 text-[#0B27BC] focus:ring-[#0B27BC]/20 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-foreground">{candidate.member_nama}</span>
                                <span className="text-xs text-gray-400">&rarr;</span>
                                <span className="text-sm text-[#0B27BC] font-medium">{candidate.alumni_nama}</span>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs px-1.5 py-0.5 rounded bg-[#0B27BC]/10 text-[#0B27BC] font-medium">TN{candidate.member_angkatan}</span>
                                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${candidate.similarity >= 85 ? "bg-emerald-100 text-emerald-700" : candidate.similarity >= 70 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                                  {candidate.similarity}% cocok
                                </span>
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Modal footer */}
                <div className="px-5 py-3 border-t border-border flex items-center justify-between bg-gray-50/50 shrink-0">
                  <p className="text-xs text-muted-foreground">
                    {formatNum(selectedPairs.size)} dari {formatNum(linkPreview.candidates.length)} dipilih
                  </p>
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
