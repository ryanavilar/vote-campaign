"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRole } from "@/lib/RoleContext";
import { useToast } from "@/components/Toast";
import { supabase } from "@/lib/supabase";
import { normalizePhone, getAllMemberPhones } from "@/lib/phone";
import {
  Loader2,
  Bot,
  Search,
  AlertTriangle,
  RefreshCw,
  Link2,
  Check,
  X,
  Phone,
  User,
  ArrowRight,
  Users as UsersIcon,
  Filter,
  GraduationCap,
  UserCheck,
} from "lucide-react";

/* ── Types ─────────────────────────────────────────────── */

interface MiminCustomer {
  _id: string;
  name: string;
  phone: string;
  created_at: string;
  [key: string]: unknown;
}

interface LinkCandidate {
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  alumni_id: string;
  alumni_nama: string;
  alumni_angkatan: number;
  confidence: "certain" | "uncertain";
  similarity: number;
}

interface LinkPreviewResult {
  candidates: LinkCandidate[];
  total_customers: number;
  total_certain: number;
  total_uncertain: number;
  total_no_match: number;
  total_already_linked: number;
}

type LinkTab = "certain" | "uncertain";

/* ── Main Page ─────────────────────────────────────────── */

export default function MiminDataPage() {
  const { isSuperAdmin, loading: roleLoading } = useRole();
  const { showToast } = useToast();

  // Customer data
  const [customers, setCustomers] = useState<MiminCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Linked phones map: normalized phone → member name
  const [linkedPhones, setLinkedPhones] = useState<Map<string, string>>(new Map());

  // Link preview
  const [linkPreview, setLinkPreview] = useState<LinkPreviewResult | null>(null);
  const [linkLoading, setLinkLoading] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [activeLinkTab, setActiveLinkTab] = useState<LinkTab>("certain");
  const [selectedPairs, setSelectedPairs] = useState<Set<string>>(new Set());
  const [confirmLoading, setConfirmLoading] = useState(false);

  // Load customers and linked phones on mount
  useEffect(() => {
    if (!roleLoading && isSuperAdmin) {
      loadCustomers();
      loadLinkedPhones();
    } else if (!roleLoading && !isSuperAdmin) {
      setLoading(false);
    }
  }, [roleLoading, isSuperAdmin]);

  async function loadLinkedPhones() {
    const { data: members } = await supabase
      .from("members")
      .select("nama, no_hp, alt_phones");
    if (!members) return;
    const map = new Map<string, string>();
    for (const m of members) {
      const phones = getAllMemberPhones(m);
      for (const p of phones) {
        map.set(p, m.nama);
      }
    }
    setLinkedPhones(map);
  }

  async function loadCustomers() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/mimin/customers?all=true");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Gagal memuat data");
      }
      const json = await res.json();
      setCustomers(json.data || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal memuat customer";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  }

  // Deduplicate: same name + same phone → treat as one
  const deduplicated = useMemo(() => {
    const seen = new Map<string, MiminCustomer>();
    for (const c of customers) {
      const key = `${(c.name || "").trim().toLowerCase()}||${(c.phone || "").replace(/\D/g, "")}`;
      if (!seen.has(key)) {
        seen.set(key, c);
      }
    }
    return Array.from(seen.values());
  }, [customers]);

  // Filtered customers
  const filtered = useMemo(() => {
    if (!search.trim()) return deduplicated;
    const q = search.toLowerCase();
    return deduplicated.filter(
      (c) =>
        (c.name || "").toLowerCase().includes(q) ||
        (c.phone || "").includes(q)
    );
  }, [deduplicated, search]);

  // Check if a customer phone is already linked to a member
  const getLinkedMember = (phone: string | undefined): string | null => {
    if (!phone || linkedPhones.size === 0) return null;
    const normalized = normalizePhone(phone.replace(/\D/g, ""));
    if (!normalized) return null;
    return linkedPhones.get(normalized) || null;
  };

  // Stats
  const stats = useMemo(() => {
    const total = deduplicated.length;
    const duplicates = customers.length - deduplicated.length;
    const withPhone = deduplicated.filter((c) => c.phone).length;
    const withName = deduplicated.filter((c) => c.name).length;
    const alreadyLinked = deduplicated.filter((c) => {
      if (!c.phone || linkedPhones.size === 0) return false;
      const normalized = normalizePhone(c.phone.replace(/\D/g, ""));
      return normalized ? linkedPhones.has(normalized) : false;
    }).length;
    return { total, duplicates, withPhone, withName, alreadyLinked };
  }, [customers, deduplicated, linkedPhones]);

  // Link preview
  async function handleLoadLinkPreview() {
    setLinkLoading(true);
    try {
      const res = await fetch("/api/mimin/link/preview");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Gagal memuat preview");
      }
      const result: LinkPreviewResult = await res.json();
      setLinkPreview(result);
      setShowLinkModal(true);
      setActiveLinkTab("certain");
      // Pre-select all "certain" matches
      const certainIds = new Set(
        result.candidates
          .filter((c) => c.confidence === "certain")
          .map((c) => c.customer_id)
      );
      setSelectedPairs(certainIds);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal memuat preview";
      showToast(msg, "error");
    } finally {
      setLinkLoading(false);
    }
  }

  async function handleConfirmLink() {
    if (!linkPreview || selectedPairs.size === 0) return;
    setConfirmLoading(true);
    try {
      const pairs = linkPreview.candidates
        .filter((c) => selectedPairs.has(c.customer_id))
        .map((c) => ({
          customer_id: c.customer_id,
          customer_name: c.customer_name,
          customer_phone: c.customer_phone,
          alumni_id: c.alumni_id,
        }));

      const res = await fetch("/api/mimin/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pairs }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Gagal menghubungkan");
      }

      const result = await res.json();
      showToast(
        `Berhasil: ${result.linked} baru, ${result.updated} diperbarui${result.failed ? `, ${result.failed} gagal` : ""}`,
        result.failed ? "error" : "success"
      );
      setShowLinkModal(false);
      setLinkPreview(null);
      // Refresh linked phones to update tags
      await loadLinkedPhones();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal menghubungkan";
      showToast(msg, "error");
    } finally {
      setConfirmLoading(false);
    }
  }

  function togglePair(customerId: string) {
    setSelectedPairs((prev) => {
      const next = new Set(prev);
      if (next.has(customerId)) next.delete(customerId);
      else next.add(customerId);
      return next;
    });
  }

  function toggleAllInTab() {
    if (!linkPreview) return;
    const tabCandidates = linkPreview.candidates.filter(
      (c) => c.confidence === activeLinkTab
    );
    const allSelected = tabCandidates.every((c) =>
      selectedPairs.has(c.customer_id)
    );
    setSelectedPairs((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        tabCandidates.forEach((c) => next.delete(c.customer_id));
      } else {
        tabCandidates.forEach((c) => next.add(c.customer_id));
      }
      return next;
    });
  }

  // Loading state
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

  // Access denied
  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-center px-4">
          <div className="p-3 rounded-full bg-red-100">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Akses Ditolak</h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            Hanya Super Admin yang dapat mengakses halaman ini.
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
              <Bot className="w-5 h-5 text-[#FE8DA1]" />
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-white">Mimin.io Data</h1>
                <p className="text-xs text-white/70">Data customer dari Mimin.io WABA</p>
              </div>
            </div>
          </div>
        </div>
        <div className="h-1 bg-gradient-to-r from-[#fcb7c3] via-[#FE8DA1] to-[#fcb7c3]" />
      </header>

      <div className="px-4 sm:px-6 py-4 space-y-4 max-w-7xl mx-auto">
        {/* Stats Cards */}
        {!loading && !error && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-white rounded-xl border border-border p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <UsersIcon className="w-4 h-4 text-[#0B27BC]" />
                <span className="text-xs text-gray-500">Unik</span>
              </div>
              <p className="text-xl font-bold text-foreground">{stats.total.toLocaleString()}</p>
              {stats.duplicates > 0 && (
                <p className="text-[10px] text-gray-400">{stats.duplicates} duplikat dihapus</p>
              )}
            </div>
            <div className="bg-white rounded-xl border border-border p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <UserCheck className="w-4 h-4 text-emerald-600" />
                <span className="text-xs text-gray-500">Terhubung</span>
              </div>
              <p className="text-xl font-bold text-emerald-600">{stats.alreadyLinked.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-xl border border-border p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <Phone className="w-4 h-4 text-[#0B27BC]" />
                <span className="text-xs text-gray-500">Punya HP</span>
              </div>
              <p className="text-xl font-bold text-foreground">{stats.withPhone.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-xl border border-border p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <User className="w-4 h-4 text-amber-600" />
                <span className="text-xs text-gray-500">Punya Nama</span>
              </div>
              <p className="text-xl font-bold text-foreground">{stats.withName.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-xl border border-border p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <Filter className="w-4 h-4 text-gray-400" />
                <span className="text-xs text-gray-500">Raw Total</span>
              </div>
              <p className="text-xl font-bold text-gray-400">{customers.length.toLocaleString()}</p>
            </div>
          </div>
        )}

        {/* Action bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cari nama atau nomor HP..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC]"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadCustomers}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-white border border-border rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={handleLoadLinkPreview}
              disabled={linkLoading || loading || customers.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-[#0B27BC] rounded-xl hover:bg-[#091fa0] transition-colors disabled:opacity-50"
            >
              {linkLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Link2 className="w-4 h-4" />
              )}
              Auto-Link Alumni
            </button>
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">{error}</p>
              <p className="text-xs text-red-600 mt-1">
                Pastikan token Mimin.io sudah dikonfigurasi di Pengaturan.
              </p>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center gap-3 py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#0B27BC]" />
            <p className="text-sm text-muted-foreground">Memuat data customer dari Mimin.io...</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && customers.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="p-3 rounded-full bg-gray-100">
              <Bot className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-sm font-medium text-foreground">Belum ada data customer</h3>
            <p className="text-xs text-muted-foreground max-w-sm">
              Pastikan token Mimin.io sudah dikonfigurasi di Pengaturan dan akun Mimin.io memiliki data customer.
            </p>
          </div>
        )}

        {/* Customer Table */}
        {!loading && !error && customers.length > 0 && (
          <>
            <div className="text-xs text-gray-500">
              {filtered.length === deduplicated.length
                ? `${deduplicated.length} customer (unik)`
                : `${filtered.length} dari ${deduplicated.length} customer (unik)`}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block bg-white rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-border text-left">
                      <th className="px-4 py-3 font-medium text-gray-500 w-12">#</th>
                      <th className="px-4 py-3 font-medium text-gray-500">Nama</th>
                      <th className="px-4 py-3 font-medium text-gray-500">No. HP</th>
                      <th className="px-4 py-3 font-medium text-gray-500">Tanggal Dibuat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map((customer, idx) => {
                      const linkedMember = getLinkedMember(customer.phone);
                      return (
                        <tr key={customer._id} className={`hover:bg-gray-50/50 ${linkedMember ? "bg-emerald-50/30" : ""}`}>
                          <td className="px-4 py-2.5 text-gray-400 text-xs">{idx + 1}</td>
                          <td className="px-4 py-2.5">
                            <span className="font-medium text-foreground">{customer.name || "—"}</span>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              {customer.phone ? (
                                <span className="font-mono text-xs text-gray-600">{customer.phone}</span>
                              ) : (
                                <span className="text-gray-400 text-xs">—</span>
                              )}
                              {linkedMember && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-medium whitespace-nowrap">
                                  <UserCheck className="w-3 h-3" />
                                  {linkedMember}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-gray-500">
                            {customer.created_at
                              ? new Date(customer.created_at).toLocaleDateString("id-ID", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-2">
              {filtered.map((customer, idx) => {
                const linkedMember = getLinkedMember(customer.phone);
                return (
                  <div
                    key={customer._id}
                    className={`bg-white rounded-xl border p-3 shadow-sm ${linkedMember ? "border-emerald-200 bg-emerald-50/30" : "border-border"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 shrink-0">{idx + 1}.</span>
                          <span className="text-sm font-medium text-foreground truncate">
                            {customer.name || "—"}
                          </span>
                        </div>
                        {customer.phone && (
                          <div className="flex items-center gap-1.5 mt-1 ml-5">
                            <Phone className="w-3 h-3 text-gray-400" />
                            <span className="font-mono text-xs text-gray-600">{customer.phone}</span>
                          </div>
                        )}
                        {linkedMember && (
                          <div className="flex items-center gap-1.5 mt-1 ml-5">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-medium">
                              <UserCheck className="w-3 h-3" />
                              Terhubung: {linkedMember}
                            </span>
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-400 shrink-0">
                        {customer.created_at
                          ? new Date(customer.created_at).toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "short",
                            })
                          : ""}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Link Preview Modal ──────────────────────────────── */}
      {showLinkModal && linkPreview && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl max-h-[90vh] flex flex-col shadow-2xl">
            {/* Modal header */}
            <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-[#0B27BC]" />
                  Auto-Link: Customer → Alumni
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {linkPreview.total_customers} total &middot;{" "}
                  {linkPreview.total_already_linked > 0 && (
                    <span className="text-emerald-600">{linkPreview.total_already_linked} sudah terhubung &middot; </span>
                  )}
                  {linkPreview.total_certain} pasti &middot;{" "}
                  {linkPreview.total_uncertain} ragu &middot;{" "}
                  {linkPreview.total_no_match} tidak cocok
                </p>
              </div>
              <button
                onClick={() => {
                  setShowLinkModal(false);
                  setLinkPreview(null);
                }}
                className="p-1.5 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Tabs */}
            <div className="px-4 py-2 border-b border-border flex gap-2 shrink-0">
              <button
                onClick={() => setActiveLinkTab("certain")}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  activeLinkTab === "certain"
                    ? "bg-emerald-100 text-emerald-700"
                    : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                Pasti ({linkPreview.total_certain})
              </button>
              <button
                onClick={() => setActiveLinkTab("uncertain")}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  activeLinkTab === "uncertain"
                    ? "bg-amber-100 text-amber-700"
                    : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                Ragu ({linkPreview.total_uncertain})
              </button>
            </div>

            {/* Candidate list */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {linkPreview.candidates.filter((c) => c.confidence === activeLinkTab).length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-400">
                  Tidak ada kandidat {activeLinkTab === "certain" ? "pasti" : "ragu-ragu"}
                </div>
              ) : (
                <>
                  {/* Select all toggle */}
                  <button
                    onClick={toggleAllInTab}
                    className="text-xs text-[#0B27BC] hover:underline mb-2"
                  >
                    {linkPreview.candidates
                      .filter((c) => c.confidence === activeLinkTab)
                      .every((c) => selectedPairs.has(c.customer_id))
                      ? "Hapus semua pilihan"
                      : "Pilih semua"}
                  </button>

                  {linkPreview.candidates
                    .filter((c) => c.confidence === activeLinkTab)
                    .map((candidate) => {
                      const isSelected = selectedPairs.has(candidate.customer_id);
                      return (
                        <button
                          key={candidate.customer_id}
                          onClick={() => togglePair(candidate.customer_id)}
                          className={`w-full text-left px-3 py-2.5 rounded-xl border transition-colors ${
                            isSelected
                              ? "border-[#0B27BC]/30 bg-[#0B27BC]/5"
                              : "border-border hover:bg-gray-50"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {/* Checkbox */}
                            <div
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                                isSelected
                                  ? "bg-[#0B27BC] border-[#0B27BC]"
                                  : "border-gray-300"
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3 text-white" />}
                            </div>

                            {/* Names */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-foreground">
                                  {candidate.customer_name}
                                </span>
                                <ArrowRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                <span className="text-sm text-[#0B27BC] font-medium">
                                  {candidate.alumni_nama}
                                </span>
                                <span className="text-[10px] text-gray-400">
                                  TN{candidate.alumni_angkatan}
                                </span>
                              </div>
                              {candidate.customer_phone && (
                                <div className="flex items-center gap-1 mt-0.5">
                                  <Phone className="w-3 h-3 text-gray-400" />
                                  <span className="text-xs text-gray-500 font-mono">
                                    {candidate.customer_phone}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Similarity badge */}
                            <span
                              className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${
                                candidate.similarity >= 85
                                  ? "bg-emerald-100 text-emerald-700"
                                  : candidate.similarity >= 70
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-red-100 text-red-700"
                              }`}
                            >
                              {candidate.similarity}%
                            </span>
                          </div>
                        </button>
                      );
                    })}
                </>
              )}
            </div>

            {/* Modal footer */}
            <div className="px-4 py-3 border-t border-border flex items-center justify-between shrink-0">
              <span className="text-xs text-gray-500">
                {selectedPairs.size} dipilih
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowLinkModal(false);
                    setLinkPreview(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleConfirmLink}
                  disabled={confirmLoading || selectedPairs.size === 0}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#0B27BC] rounded-lg hover:bg-[#091fa0] transition-colors disabled:opacity-50"
                >
                  {confirmLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Link2 className="w-4 h-4" />
                  )}
                  Hubungkan ({selectedPairs.size})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
