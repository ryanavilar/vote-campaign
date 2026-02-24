"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRole } from "@/lib/RoleContext";
import { useToast } from "@/components/Toast";
import {
  Smartphone,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Search,
  X,
  Link2,
  Unlink,
  Users,
  UserCheck,
  UserX,
  Check,
  CheckCircle2,
  XCircle,
  Wifi,
  Download,
  Database,
} from "lucide-react";
import type { WaGroupMember } from "@/lib/types";

interface SearchMember {
  id: string;
  nama: string;
  no_hp: string;
  angkatan: number;
}

export default function WaGroupPage() {
  const { canManageUsers, isSuperAdmin, loading: roleLoading } = useRole();
  const { showToast } = useToast();

  const [members, setMembers] = useState<WaGroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncModal, setSyncModal] = useState(false);
  const [syncStep, setSyncStep] = useState(0); // 0=idle, 1=connecting, 2=fetching, 3=saving, 4=linking, 5=done, -1=error
  const [syncResult, setSyncResult] = useState<{
    synced: number;
    total: number;
    added: { phone: string; wa_name: string | null }[];
    updated: { phone: string; wa_name: string | null }[];
    linked: { phone: string; wa_name: string | null; member_nama: string; angkatan: number }[];
    stillUnlinked: { phone: string; wa_name: string | null }[];
    lidEntries: { phone: string; wa_name: string | null }[];
    failed: { phone: string; wa_name: string | null; reason: string }[];
  } | null>(null);
  const [resultTab, setResultTab] = useState<"added" | "updated" | "linked" | "unlinked" | "lid" | "failed">("linked");
  const [syncError, setSyncError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "linked" | "unlinked">("all");

  // Link modal state
  const [linkTarget, setLinkTarget] = useState<WaGroupMember | null>(null);
  const [linkSearch, setLinkSearch] = useState("");
  const [linkResults, setLinkResults] = useState<SearchMember[]>([]);
  const [linkSearching, setLinkSearching] = useState(false);
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    if (!roleLoading && canManageUsers) {
      loadData();
    } else if (!roleLoading && !canManageUsers) {
      setLoading(false);
    }
  }, [roleLoading, canManageUsers]);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch("/api/wa-group");
      if (!res.ok) throw new Error("Gagal memuat data");
      const json = await res.json();
      setMembers(json.data || []);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Gagal memuat data", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setSyncModal(true);
    setSyncStep(1);
    setSyncResult(null);
    setSyncError(null);
    setResultTab("linked");

    // Simulate step progression while waiting for API
    const stepTimer1 = setTimeout(() => setSyncStep(2), 1500);
    const stepTimer2 = setTimeout(() => setSyncStep(3), 4000);
    const stepTimer3 = setTimeout(() => setSyncStep(4), 7000);

    try {
      const res = await fetch("/api/wa-group", { method: "POST" });
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      clearTimeout(stepTimer3);

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Gagal sync");
      }
      const result = await res.json();
      setSyncResult(result);
      setSyncStep(5);
      await loadData();
    } catch (err) {
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      clearTimeout(stepTimer3);
      setSyncError(err instanceof Error ? err.message : "Gagal sync");
      setSyncStep(-1);
    } finally {
      setSyncing(false);
    }
  }

  // Search members for link modal
  useEffect(() => {
    if (!linkTarget || !linkSearch.trim()) {
      setLinkResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setLinkSearching(true);
      try {
        const res = await fetch(`/api/wa-group/search-members?q=${encodeURIComponent(linkSearch)}`);
        if (res.ok) {
          const json = await res.json();
          setLinkResults(json.data || []);
        }
      } catch {
        // ignore
      } finally {
        setLinkSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [linkSearch, linkTarget]);

  async function handleLink(waGroupMemberId: string, memberId: string) {
    setLinking(true);
    try {
      const res = await fetch("/api/wa-group", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ waGroupMemberId, memberId }),
      });
      if (!res.ok) throw new Error("Gagal menghubungkan");
      showToast("Berhasil dihubungkan!", "success");
      setLinkTarget(null);
      setLinkSearch("");
      await loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Gagal menghubungkan", "error");
    } finally {
      setLinking(false);
    }
  }

  async function handleUnlink(waGroupMemberId: string) {
    try {
      const res = await fetch("/api/wa-group", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ waGroupMemberId, memberId: null }),
      });
      if (!res.ok) throw new Error("Gagal memutus hubungan");
      showToast("Hubungan diputus", "success");
      await loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Gagal memutus hubungan", "error");
    }
  }

  // Filter
  const filtered = useMemo(() => {
    let result = members;

    // Status filter
    if (statusFilter === "linked") {
      result = result.filter((m) => m.member_id);
    } else if (statusFilter === "unlinked") {
      result = result.filter((m) => !m.member_id);
    }

    // Text search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (m) =>
          m.phone.includes(q) ||
          (m.wa_name && m.wa_name.toLowerCase().includes(q)) ||
          (m.member && m.member.nama.toLowerCase().includes(q))
      );
    }

    return result;
  }, [members, searchQuery, statusFilter]);

  const linkedCount = members.filter((m) => m.member_id).length;
  const unlinkedCount = members.length - linkedCount;

  // Loading state
  if (roleLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#0B27BC]" />
          <p className="text-sm text-muted-foreground">Memuat data...</p>
        </div>
      </div>
    );
  }

  // Access denied
  if (!canManageUsers) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-center px-4">
          <div className="p-3 rounded-full bg-red-100">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Akses Ditolak</h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            Hanya admin yang dapat mengakses halaman ini.
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
              <Smartphone className="w-5 h-5 text-[#FE8DA1]" />
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-white">WA Group Member</h1>
                <p className="text-xs text-white/70">Kelola anggota grup WhatsApp</p>
              </div>
            </div>
            {isSuperAdmin && (
              <button
                onClick={handleSync}
                disabled={syncing}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white/15 hover:bg-white/25 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {syncing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                {syncing ? "Syncing..." : "Sync"}
              </button>
            )}
          </div>
        </div>
        <div className="h-1 bg-gradient-to-r from-[#fcb7c3] via-[#FE8DA1] to-[#fcb7c3]" />
      </header>

      <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto space-y-4">
        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-border p-4 text-center shadow-sm">
            <Users className="w-5 h-5 text-[#0B27BC] mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{members.length}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
          <div className="bg-white rounded-xl border border-border p-4 text-center shadow-sm">
            <UserCheck className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
            <p className="text-2xl font-bold text-emerald-600">{linkedCount}</p>
            <p className="text-xs text-muted-foreground">Linked</p>
          </div>
          <div className="bg-white rounded-xl border border-border p-4 text-center shadow-sm">
            <UserX className="w-5 h-5 text-amber-500 mx-auto mb-1" />
            <p className="text-2xl font-bold text-amber-500">{unlinkedCount}</p>
            <p className="text-xs text-muted-foreground">Unlinked</p>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cari nomor, nama WA, atau nama anggota..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 text-sm border border-border rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
              </button>
            )}
          </div>

          {/* Status Filter Chips */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setStatusFilter("all")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                statusFilter === "all"
                  ? "bg-[#0B27BC] text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <Users className="w-3 h-3" />
              Semua ({members.length})
            </button>
            <button
              onClick={() => setStatusFilter("linked")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                statusFilter === "linked"
                  ? "bg-emerald-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <UserCheck className="w-3 h-3" />
              Linked ({linkedCount})
            </button>
            <button
              onClick={() => setStatusFilter("unlinked")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                statusFilter === "unlinked"
                  ? "bg-amber-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <UserX className="w-3 h-3" />
              Unlinked ({unlinkedCount})
            </button>
          </div>
        </div>

        {/* Table */}
        {members.length === 0 ? (
          <div className="bg-white rounded-xl border border-border p-8 text-center shadow-sm">
            <Smartphone className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-foreground mb-1">Belum ada data</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Klik tombol &quot;Sync&quot; untuk mengambil data peserta dari grup WhatsApp.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-border">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      No. HP
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Nama WA
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Anggota Terhubung
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((wm) => (
                    <tr key={wm.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-gray-700">
                        {wm.phone}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {wm.wa_name || <span className="text-gray-400 italic">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {wm.member ? (
                          <div>
                            <span className="font-medium text-foreground">{wm.member.nama}</span>
                            <span className="text-xs text-muted-foreground ml-1">
                              ({wm.member.angkatan})
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">Belum terhubung</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {wm.member_id ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700 rounded-full">
                            <Check className="w-3 h-3" />
                            Linked
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
                            Unlinked
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {wm.member_id ? (
                          <button
                            onClick={() => handleUnlink(wm.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                          >
                            <Unlink className="w-3 h-3" />
                            Unlink
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setLinkTarget(wm);
                              setLinkSearch("");
                              setLinkResults([]);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[#0B27BC] bg-[#0B27BC]/10 hover:bg-[#0B27BC]/20 rounded-lg transition-colors"
                          >
                            <Link2 className="w-3 h-3" />
                            Link
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filtered.length === 0 && (searchQuery || statusFilter !== "all") && (
              <div className="p-6 text-center text-sm text-muted-foreground">
                {searchQuery
                  ? `Tidak ada hasil untuk "${searchQuery}"${statusFilter !== "all" ? ` (filter: ${statusFilter})` : ""}`
                  : `Tidak ada anggota dengan status "${statusFilter}"`}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sync Progress Modal */}
      {syncModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <RefreshCw className={`w-4 h-4 text-[#0B27BC] ${syncing ? "animate-spin" : ""}`} />
                Sinkronisasi WA Group
              </h3>
            </div>

            {/* Steps */}
            <div className="px-5 py-5 space-y-4">
              {[
                { step: 1, icon: Wifi, label: "Menghubungkan ke WAHA Server", desc: "Memuat konfigurasi dan menghubungkan ke server WhatsApp" },
                { step: 2, icon: Download, label: "Mengambil data peserta grup", desc: "Mengambil daftar peserta dari grup WhatsApp" },
                { step: 3, icon: Database, label: "Menyimpan ke database", desc: "Menyimpan dan memperbarui data peserta di database" },
                { step: 4, icon: Link2, label: "Auto-linking anggota", desc: "Membersihkan nomor HP & mencocokkan peserta dengan data anggota" },
              ].map((s) => {
                const Icon = s.icon;
                const isActive = syncStep === s.step;
                const isDone = syncStep > s.step || syncStep === 5;
                const isError = syncStep === -1 && syncStep !== s.step;
                const isPending = syncStep < s.step && syncStep !== 5 && syncStep !== -1;

                return (
                  <div key={s.step} className="flex items-start gap-3">
                    <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                      isDone
                        ? "bg-emerald-100"
                        : isActive
                        ? "bg-[#0B27BC]/10"
                        : "bg-gray-100"
                    }`}>
                      {isDone ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : isActive ? (
                        <Loader2 className="w-4 h-4 text-[#0B27BC] animate-spin" />
                      ) : (
                        <Icon className={`w-4 h-4 ${isPending ? "text-gray-300" : "text-gray-400"}`} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <p className={`text-sm font-medium transition-colors ${
                        isDone
                          ? "text-emerald-700"
                          : isActive
                          ? "text-foreground"
                          : "text-gray-400"
                      }`}>
                        {s.label}
                      </p>
                      {isActive && (
                        <p className="text-xs text-muted-foreground mt-0.5">{s.desc}</p>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Error state */}
              {syncStep === -1 && syncError && (
                <div className="flex items-start gap-3 p-3 rounded-xl bg-red-50 border border-red-200">
                  <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-700">Sync gagal</p>
                    <p className="text-xs text-red-600 mt-0.5">{syncError}</p>
                  </div>
                </div>
              )}

              {/* Success state */}
              {syncStep === 5 && syncResult && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <p className="text-sm font-semibold text-emerald-700">Sync berhasil!</p>
                  </div>

                  {/* Total summary line */}
                  <p className="text-xs text-muted-foreground text-center">
                    Total dari WAHA: <span className="font-semibold text-foreground">{syncResult.total}</span> peserta
                  </p>

                  {/* Summary counts */}
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { key: "added" as const, count: syncResult.added.length, label: "Baru", color: "text-blue-600 bg-blue-50 border-blue-200" },
                      { key: "updated" as const, count: syncResult.updated.length, label: "Update", color: "text-purple-600 bg-purple-50 border-purple-200" },
                      { key: "linked" as const, count: syncResult.linked.length, label: "Linked", color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
                      { key: "unlinked" as const, count: syncResult.stillUnlinked.length, label: "Unlinked", color: "text-amber-600 bg-amber-50 border-amber-200" },
                      { key: "lid" as const, count: (syncResult.lidEntries || []).length, label: "LID", color: "text-gray-600 bg-gray-50 border-gray-200" },
                      { key: "failed" as const, count: syncResult.failed.length, label: "Gagal", color: "text-red-600 bg-red-50 border-red-200" },
                    ].map((t) => (
                      <button
                        key={t.key}
                        onClick={() => setResultTab(t.key)}
                        className={`rounded-lg border p-1.5 text-center transition-all ${t.color} ${
                          resultTab === t.key ? "ring-2 ring-offset-1 ring-current" : "opacity-70 hover:opacity-100"
                        }`}
                      >
                        <p className="text-base font-bold">{t.count}</p>
                        <p className="text-[9px] font-medium">{t.label}</p>
                      </button>
                    ))}
                  </div>

                  {/* Detail list */}
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-gray-50/50">
                    {resultTab === "added" && (
                      syncResult.added.length > 0 ? (
                        <div className="divide-y divide-border">
                          {syncResult.added.map((item, i) => (
                            <div key={i} className="px-3 py-2 flex items-center gap-2">
                              <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                                <Users className="w-3 h-3 text-blue-600" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium text-foreground truncate">
                                  {item.wa_name || "—"}
                                </p>
                                <p className="text-[10px] text-muted-foreground font-mono">{item.phone}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground text-center py-6">Tidak ada peserta baru</p>
                      )
                    )}
                    {resultTab === "updated" && (
                      syncResult.updated.length > 0 ? (
                        <div className="divide-y divide-border">
                          {syncResult.updated.map((item, i) => (
                            <div key={i} className="px-3 py-2 flex items-center gap-2">
                              <div className="w-5 h-5 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                                <RefreshCw className="w-3 h-3 text-purple-600" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium text-foreground truncate">
                                  {item.wa_name || "—"}
                                </p>
                                <p className="text-[10px] text-muted-foreground font-mono">{item.phone}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground text-center py-6">Tidak ada data yang diperbarui</p>
                      )
                    )}
                    {resultTab === "linked" && (
                      syncResult.linked.length > 0 ? (
                        <div className="divide-y divide-border">
                          {syncResult.linked.map((item, i) => (
                            <div key={i} className="px-3 py-2 flex items-center gap-2">
                              <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                                <Link2 className="w-3 h-3 text-emerald-600" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium text-foreground truncate">
                                  {item.wa_name || item.phone}
                                  <span className="text-emerald-600 font-normal"> → {item.member_nama}</span>
                                  <span className="text-muted-foreground font-normal"> ({item.angkatan})</span>
                                </p>
                                <p className="text-[10px] text-muted-foreground font-mono">{item.phone}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground text-center py-6">Tidak ada link baru</p>
                      )
                    )}
                    {resultTab === "unlinked" && (
                      syncResult.stillUnlinked.length > 0 ? (
                        <div className="divide-y divide-border">
                          {syncResult.stillUnlinked.map((item, i) => (
                            <div key={i} className="px-3 py-2 flex items-center gap-2">
                              <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                                <UserX className="w-3 h-3 text-amber-600" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium text-foreground truncate">
                                  {item.wa_name || "—"}
                                </p>
                                <p className="text-[10px] text-muted-foreground font-mono">{item.phone}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground text-center py-6">Semua peserta sudah terhubung!</p>
                      )
                    )}
                    {resultTab === "lid" && (
                      (syncResult.lidEntries || []).length > 0 ? (
                        <div>
                          <div className="px-3 py-2 bg-gray-100 border-b border-border">
                            <p className="text-[10px] text-gray-500">
                              💡 Peserta ini menggunakan WhatsApp Linked ID (LID) — nomor HP asli tidak tersedia dari WAHA.
                              Mereka tetap disimpan tapi tidak bisa di-auto-link.
                            </p>
                          </div>
                          <div className="divide-y divide-border">
                            {(syncResult.lidEntries || []).map((item, i) => (
                              <div key={i} className="px-3 py-2 flex items-center gap-2">
                                <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                                  <Smartphone className="w-3 h-3 text-gray-500" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-medium text-foreground truncate">
                                    {item.wa_name || "—"}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground font-mono">{item.phone}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground text-center py-6">Tidak ada peserta LID</p>
                      )
                    )}
                    {resultTab === "failed" && (
                      syncResult.failed.length > 0 ? (
                        <div className="divide-y divide-border">
                          {syncResult.failed.map((item, i) => (
                            <div key={i} className="px-3 py-2 flex items-center gap-2">
                              <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                                <XCircle className="w-3 h-3 text-red-600" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium text-foreground truncate">
                                  {item.wa_name || item.phone}
                                </p>
                                <p className="text-[10px] text-red-500">{item.reason}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground text-center py-6">Tidak ada yang gagal!</p>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-border bg-gray-50/80">
              {syncStep === 5 || syncStep === -1 ? (
                <button
                  onClick={() => {
                    setSyncModal(false);
                    setSyncStep(0);
                  }}
                  className="w-full px-4 py-2 text-sm font-medium text-white bg-[#0B27BC] rounded-lg hover:bg-[#091fa0] transition-colors"
                >
                  Tutup
                </button>
              ) : (
                <p className="text-xs text-center text-muted-foreground">
                  Proses ini membutuhkan beberapa detik, mohon tunggu...
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Link Modal */}
      {linkTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Hubungkan ke Anggota</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {linkTarget.phone}
                  {linkTarget.wa_name ? ` — ${linkTarget.wa_name}` : ""}
                </p>
              </div>
              <button
                onClick={() => setLinkTarget(null)}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            {/* Search */}
            <div className="px-5 py-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Cari nama atau nomor HP anggota..."
                  value={linkSearch}
                  onChange={(e) => setLinkSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC]"
                  autoFocus
                />
              </div>
            </div>

            {/* Results */}
            <div className="px-5 pb-4 max-h-64 overflow-y-auto">
              {linkSearching ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-[#0B27BC]" />
                </div>
              ) : linkResults.length > 0 ? (
                <div className="space-y-1">
                  {linkResults.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => handleLink(linkTarget.id, m.id)}
                      disabled={linking}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-[#0B27BC]/5 transition-colors disabled:opacity-50"
                    >
                      <div className="w-8 h-8 rounded-full bg-[#0B27BC]/10 flex items-center justify-center text-xs font-bold text-[#0B27BC] shrink-0">
                        {m.nama.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{m.nama}</p>
                        <p className="text-xs text-muted-foreground">
                          {m.no_hp} &middot; Angkatan {m.angkatan}
                        </p>
                      </div>
                      <Link2 className="w-4 h-4 text-[#0B27BC] shrink-0" />
                    </button>
                  ))}
                </div>
              ) : linkSearch.trim() ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Tidak ditemukan anggota untuk &quot;{linkSearch}&quot;
                </p>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Ketik nama atau nomor HP untuk mencari anggota
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
