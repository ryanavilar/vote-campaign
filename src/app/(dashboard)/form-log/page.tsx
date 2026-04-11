"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  ClipboardList,
  Loader2,
  Search,
  User,
  Clock,
  Filter,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  UserCheck,
  Calendar,
  Heart,
  AlertTriangle,
  Link2,
} from "lucide-react";
import { useRouter, usePathname } from "next/navigation";

interface FormSubmission {
  id: string;
  type: "dukungan" | "event";
  member_id: string | null;
  is_new_member: boolean;
  nama: string;
  angkatan: number;
  no_hp: string | null;
  email: string | null;
  domisili: string | null;
  harapan: string | null;
  referral_name: string | null;
  event_id: string | null;
  event_name: string | null;
  will_attend: boolean | null;
  has_alumni_link: boolean;
  created_at: string;
}

export default function FormLogPage() {
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [unlinkedCount, setUnlinkedCount] = useState(0);
  const router = useRouter();
  const pathname = usePathname();
  const limit = 50;

  // Re-fetch when navigating back to this page or when page/filter changes
  useEffect(() => {
    fetchSubmissions();
  }, [page, filterType, pathname]);

  async function fetchSubmissions() {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (filterType !== "all") params.set("type", filterType);
    if (searchQuery.trim()) params.set("search", searchQuery.trim());

    const res = await fetch(`/api/form-log?${params}`);
    const json = await res.json();
    setSubmissions(json.data || []);
    setTotal(json.total || 0);
    setUnlinkedCount(json.unlinked_count || 0);
    setLoading(false);
  }

  function handleSearch() {
    setPage(1);
    fetchSubmissions();
  }

  const totalPages = Math.ceil(total / limit);

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function timeAgo(dateStr: string) {
    const now = new Date();
    const d = new Date(dateStr);
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "baru saja";
    if (diffMins < 60) return `${diffMins} menit lalu`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} jam lalu`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays} hari lalu`;
    return formatDate(dateStr);
  }

  return (
    <div className="bg-background min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0B27BC] text-white shadow-lg">
        <div className="px-4 sm:px-6 py-3">
          <div className="flex items-center gap-3">
            <ClipboardList className="w-5 h-5 text-[#FE8DA1]" />
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-white">
                Log Pendaftaran
              </h1>
              <p className="text-xs text-white/70">
                {total} entri dari form publik
              </p>
            </div>
          </div>
        </div>
        <div className="h-1 bg-gradient-to-r from-[#fcb7c3] via-[#FE8DA1] to-[#fcb7c3]" />
      </header>

      <div className="px-4 sm:px-6 py-6 space-y-4">
        {/* Unlinked warning */}
        {unlinkedCount > 0 && (
          <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">
                {unlinkedCount} pendaftar belum terhubung ke data alumni
              </p>
              <p className="text-xs text-amber-600 mt-0.5">
                Pendaftar ini perlu di-review dan dihubungkan secara manual di halaman Alumni.
              </p>
              <button
                onClick={() => router.push("/admin/alumni")}
                className="mt-2 text-xs font-medium text-amber-700 hover:text-amber-900 flex items-center gap-1"
              >
                <Link2 className="w-3 h-3" />
                Buka halaman Alumni
              </button>
            </div>
          </div>
        )}

        {/* Search + Filter */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Cari nama, no HP, referral..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC] bg-white"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20"
            >
              <option value="all">Semua Tipe</option>
              <option value="dukungan">Dukungan</option>
              <option value="event">Event</option>
            </select>
            <button
              onClick={handleSearch}
              className="px-4 py-2 text-sm bg-[#0B27BC] text-white rounded-lg hover:bg-[#0B27BC]/90 transition-colors"
            >
              Cari
            </button>
          </div>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#0B27BC]" />
            <p className="text-sm text-muted-foreground">Memuat log...</p>
          </div>
        ) : submissions.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12">
            <ClipboardList className="w-10 h-10 text-gray-300" />
            <p className="text-sm text-muted-foreground">
              Belum ada entri pendaftaran
            </p>
          </div>
        ) : (
          <>
            {/* Submission Cards */}
            <div className="space-y-3">
              {submissions.map((sub) => (
                <div
                  key={sub.id}
                  className="bg-white rounded-xl border border-border shadow-sm hover:shadow-md transition-all"
                >
                  <button
                    onClick={() =>
                      setExpanded(expanded === sub.id ? null : sub.id)
                    }
                    className="w-full text-left p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                            sub.type === "dukungan"
                              ? "bg-pink-50"
                              : "bg-blue-50"
                          }`}
                        >
                          {sub.type === "dukungan" ? (
                            <Heart className="w-4 h-4 text-[#FE8DA1]" />
                          ) : (
                            <Calendar className="w-4 h-4 text-[#0B27BC]" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-foreground">
                              {sub.nama}
                            </p>
                            <span className="text-xs text-muted-foreground">
                              TN{sub.angkatan}
                            </span>
                            {sub.is_new_member ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-green-50 text-green-700 rounded-full">
                                <UserPlus className="w-3 h-3" />
                                Baru
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-600 rounded-full">
                                <UserCheck className="w-3 h-3" />
                                Update
                              </span>
                            )}
                            {!sub.has_alumni_link && sub.member_id && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-amber-50 text-amber-700 rounded-full">
                                <AlertTriangle className="w-3 h-3" />
                                Belum terhubung alumni
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span
                              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                sub.type === "dukungan"
                                  ? "bg-pink-50 text-pink-700"
                                  : "bg-blue-50 text-blue-700"
                              }`}
                            >
                              {sub.type === "dukungan" ? "Dukungan" : "Event"}
                            </span>
                            {sub.event_name && (
                              <span className="text-xs text-muted-foreground truncate">
                                {sub.event_name}
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {timeAgo(sub.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {expanded === sub.id && (
                    <div className="px-4 pb-4 pt-0 border-t border-border mt-0">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 text-sm">
                        {sub.no_hp && (
                          <div>
                            <p className="text-xs text-muted-foreground">
                              No HP
                            </p>
                            <p className="font-medium">{sub.no_hp}</p>
                          </div>
                        )}
                        {sub.email && (
                          <div>
                            <p className="text-xs text-muted-foreground">
                              Email
                            </p>
                            <p className="font-medium">{sub.email}</p>
                          </div>
                        )}
                        {sub.domisili && (
                          <div>
                            <p className="text-xs text-muted-foreground">
                              Domisili
                            </p>
                            <p className="font-medium">{sub.domisili}</p>
                          </div>
                        )}
                        {sub.referral_name && (
                          <div>
                            <p className="text-xs text-muted-foreground">
                              Referral
                            </p>
                            <p className="font-medium">{sub.referral_name}</p>
                          </div>
                        )}
                        {sub.harapan && (
                          <div className="sm:col-span-2">
                            <p className="text-xs text-muted-foreground">
                              Harapan
                            </p>
                            <p className="font-medium whitespace-pre-wrap">
                              {sub.harapan}
                            </p>
                          </div>
                        )}
                        {sub.type === "event" && sub.will_attend !== null && (
                          <div>
                            <p className="text-xs text-muted-foreground">
                              Akan Hadir
                            </p>
                            <p className="font-medium">
                              {sub.will_attend ? "Ya" : "Tidak"}
                            </p>
                          </div>
                        )}
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Waktu Submit
                          </p>
                          <p className="font-medium">
                            {formatDate(sub.created_at)}
                          </p>
                        </div>
                      </div>
                      {sub.member_id && (
                        <button
                          onClick={() =>
                            router.push(`/anggota/${sub.member_id}`)
                          }
                          className="mt-3 text-xs text-[#0B27BC] hover:underline flex items-center gap-1"
                        >
                          <User className="w-3 h-3" />
                          Lihat profil anggota
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <p className="text-xs text-muted-foreground">
                  Hal {page} dari {totalPages} ({total} entri)
                </p>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="p-2 rounded-lg border border-border hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages}
                    className="p-2 rounded-lg border border-border hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
