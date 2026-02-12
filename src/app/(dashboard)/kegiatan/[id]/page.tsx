"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useRole } from "@/lib/RoleContext";
import { useToast } from "@/components/Toast";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { EventForm } from "@/components/EventForm";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Users,
  Loader2,
  Copy,
  Check,
  Pencil,
  Trash2,
  Play,
  CheckCircle,
  XCircle,
  UserPlus,
  X,
  Search,
  ClipboardList,
  ExternalLink,
  Link as LinkIcon,
} from "lucide-react";
import type { Event, EventAttendance, EventRegistration, Member } from "@/lib/types";

const STATUS_BADGE_COLORS: Record<Event["status"], string> = {
  Terjadwal: "bg-blue-100 text-blue-700",
  Berlangsung: "bg-emerald-100 text-emerald-700",
  Selesai: "bg-gray-100 text-gray-600",
  Dibatalkan: "bg-red-100 text-red-700",
};

const JENIS_BADGE_COLORS: Record<Event["jenis"], string> = {
  Silaturahmi: "bg-purple-100 text-purple-700",
  Rapat: "bg-[#0B27BC]/10 text-[#0B27BC]",
  "Door-to-door": "bg-amber-100 text-amber-700",
  Rally: "bg-[#FE8DA1]/20 text-[#84303F]",
  Sosialisasi: "bg-teal-100 text-teal-700",
  Lainnya: "bg-gray-100 text-gray-600",
};

function formatTanggal(tanggal: string): string {
  return new Date(tanggal).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { canEdit: userCanEdit, canDelete: userCanDelete } = useRole();
  const { showToast } = useToast();

  const [event, setEvent] = useState<Event | null>(null);
  const [attendance, setAttendance] = useState<EventAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);

  // Check-in form state
  const [showCheckinForm, setShowCheckinForm] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [checkinCatatan, setCheckinCatatan] = useState("");
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [removeLoading, setRemoveLoading] = useState<string | null>(null);

  // RSVP registrations state
  const [registrations, setRegistrations] = useState<EventRegistration[]>([]);
  const [checkinFilter, setCheckinFilter] = useState<"all" | "rsvp">("all");

  const fetchEvent = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${id}`);
      if (!res.ok) throw new Error("Gagal memuat kegiatan");
      const data = await res.json();
      setEvent(data);
    } catch {
      showToast("Gagal memuat data kegiatan", "error");
    }
  }, [id, showToast]);

  const fetchAttendance = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${id}/attendance`);
      if (!res.ok) throw new Error("Gagal memuat absensi");
      const data = await res.json();
      setAttendance(data);
    } catch {
      showToast("Gagal memuat data absensi", "error");
    }
  }, [id, showToast]);

  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch("/api/members");
      if (!res.ok) throw new Error("Gagal memuat anggota");
      const data = await res.json();
      setMembers(data);
    } catch {
      // silently fail, members just won't load
    }
  }, []);

  const fetchRegistrations = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${id}/registrations`);
      if (!res.ok) return;
      const data = await res.json();
      setRegistrations(data);
    } catch {
      // silently fail
    }
  }, [id]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchEvent(), fetchAttendance(), fetchMembers(), fetchRegistrations()]);
      setLoading(false);
    };
    loadData();
  }, [fetchEvent, fetchAttendance, fetchMembers, fetchRegistrations]);

  const handleCopyCode = async () => {
    if (!event?.checkin_code) return;
    try {
      await navigator.clipboard.writeText(event.checkin_code);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      showToast("Gagal menyalin kode", "error");
    }
  };

  const handleCopyFormLink = async () => {
    if (!event?.checkin_code) return;
    try {
      const url = `${window.location.origin}/form/${event.checkin_code}`;
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      showToast("Gagal menyalin link", "error");
    }
  };

  const handleStatusChange = async (newStatus: Event["status"]) => {
    if (!event) return;
    setStatusLoading(true);
    try {
      const res = await fetch(`/api/events/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Gagal mengubah status");
      }
      const updated = await res.json();
      setEvent(updated);
      showToast(`Status berhasil diubah ke "${newStatus}"`, "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Gagal mengubah status",
        "error"
      );
    } finally {
      setStatusLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/events/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Gagal menghapus kegiatan");
      }
      showToast("Kegiatan berhasil dihapus", "success");
      router.push("/kegiatan");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Gagal menghapus kegiatan",
        "error"
      );
    } finally {
      setDeleteLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleEventUpdated = (updatedEvent: Event) => {
    setEvent(updatedEvent);
    setIsEditing(false);
    showToast("Kegiatan berhasil diperbarui", "success");
  };

  const handleCheckin = async () => {
    if (!selectedMember) return;
    setCheckinLoading(true);
    try {
      const res = await fetch(`/api/events/${id}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          member_id: selectedMember.id,
          catatan: checkinCatatan.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Gagal check-in");
      }
      const newAttendance = await res.json();
      setAttendance((prev) => [newAttendance, ...prev]);
      setSelectedMember(null);
      setMemberSearch("");
      setCheckinCatatan("");
      setShowCheckinForm(false);
      if (event) {
        setEvent({
          ...event,
          attendance_count: (event.attendance_count ?? 0) + 1,
        });
      }
      showToast(`${selectedMember.nama} berhasil check-in`, "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Gagal check-in",
        "error"
      );
    } finally {
      setCheckinLoading(false);
    }
  };

  const handleRemoveAttendance = async (attendanceId: string) => {
    setRemoveLoading(attendanceId);
    try {
      const res = await fetch(
        `/api/events/${id}/attendance?attendance_id=${attendanceId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Gagal menghapus check-in");
      }
      setAttendance((prev) => prev.filter((a) => a.id !== attendanceId));
      if (event) {
        setEvent({
          ...event,
          attendance_count: Math.max((event.attendance_count ?? 1) - 1, 0),
        });
      }
      showToast("Check-in berhasil dihapus", "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Gagal menghapus check-in",
        "error"
      );
    } finally {
      setRemoveLoading(null);
    }
  };

  // Filter members for check-in dropdown (exclude already checked-in members)
  const checkedInMemberIds = new Set(attendance.map((a) => a.member_id));
  const rsvpMemberIds = new Set(registrations.map((r) => r.member_id));
  const filteredMembers = members.filter((m) => {
    if (checkedInMemberIds.has(m.id)) return false;
    if (checkinFilter === "rsvp" && !rsvpMemberIds.has(m.id)) return false;
    if (checkinFilter === "all" && memberSearch === "") return false;
    if (memberSearch !== "" &&
      !m.nama.toLowerCase().includes(memberSearch.toLowerCase()) &&
      !String(m.angkatan).includes(memberSearch)
    ) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#0B27BC]" />
          <p className="text-sm text-muted-foreground">Memuat kegiatan...</p>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-background px-4 py-8">
        <EmptyState
          icon={Calendar}
          title="Kegiatan tidak ditemukan"
          description="Kegiatan yang Anda cari tidak ada atau telah dihapus."
          action={{ label: "Kembali", onClick: () => router.push("/kegiatan") }}
        />
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0B27BC] text-white shadow-lg">
        <div className="px-4 sm:px-6 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/kegiatan")}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-white truncate">
                {event.nama}
              </h1>
              <p className="text-xs text-white/70">Detail Kegiatan</p>
            </div>
          </div>
        </div>
        <div className="h-1 bg-gradient-to-r from-[#fcb7c3] via-[#FE8DA1] to-[#fcb7c3]" />
      </header>

      <div className="px-4 sm:px-6 py-6 space-y-4">
        {/* Edit Form (inline) */}
        {isEditing && (
          <EventForm
            event={event}
            onSave={handleEventUpdated}
            onCancel={() => setIsEditing(false)}
          />
        )}

        {/* Event Info Card */}
        {!isEditing && (
          <div className="bg-white rounded-xl border border-border p-4 sm:p-6 shadow-sm space-y-4">
            {/* Badges row */}
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${JENIS_BADGE_COLORS[event.jenis]}`}
              >
                {event.jenis}
              </span>
              <span
                className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${STATUS_BADGE_COLORS[event.status]}`}
              >
                {event.status}
              </span>
            </div>

            {/* Details */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4 shrink-0 text-[#0B27BC]" />
                <span>{formatTanggal(event.tanggal)}</span>
              </div>
              {event.lokasi && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="w-4 h-4 shrink-0 text-[#0B27BC]" />
                  <span>{event.lokasi}</span>
                </div>
              )}
              {event.deskripsi && (
                <p className="text-sm text-muted-foreground pt-1">
                  {event.deskripsi}
                </p>
              )}
            </div>

            {/* Action Buttons */}
            {userCanEdit && (
              <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-border">
                <button
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#0B27BC] bg-[#0B27BC]/10 rounded-lg hover:bg-[#0B27BC]/20 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </button>

                {event.status === "Terjadwal" && (
                  <button
                    onClick={() => handleStatusChange("Berlangsung")}
                    disabled={statusLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-100 rounded-lg hover:bg-emerald-200 transition-colors disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Mulai
                  </button>
                )}

                {event.status === "Berlangsung" && (
                  <button
                    onClick={() => handleStatusChange("Selesai")}
                    disabled={statusLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    Selesai
                  </button>
                )}

                {(event.status === "Terjadwal" ||
                  event.status === "Berlangsung") && (
                  <button
                    onClick={() => handleStatusChange("Dibatalkan")}
                    disabled={statusLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200 transition-colors disabled:opacity-50"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Batalkan
                  </button>
                )}

                {userCanDelete && (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors ml-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Hapus
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Check-in Code Card */}
        {event.checkin_code && (
          <div className="bg-white rounded-xl border border-border p-4 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">
                Kode Check-in
              </h3>
              <button
                onClick={handleCopyCode}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-[#0B27BC] bg-[#0B27BC]/10 rounded-lg hover:bg-[#0B27BC]/20 transition-colors"
              >
                {codeCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Tersalin
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Salin
                  </>
                )}
              </button>
            </div>
            <div className="flex items-center justify-center py-4 bg-gray-50 rounded-lg border border-dashed border-border">
              <span className="text-3xl sm:text-4xl font-mono font-bold tracking-[0.3em] text-[#0B27BC]">
                {event.checkin_code}
              </span>
            </div>
          </div>
        )}

        {/* Public Form Link Card */}
        {event.checkin_code &&
          event.status !== "Dibatalkan" &&
          event.status !== "Selesai" && (
            <div className="bg-white rounded-xl border border-border p-4 sm:p-6 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <LinkIcon className="w-4 h-4 text-[#0B27BC]" />
                  Link Formulir Publik
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyFormLink}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-[#0B27BC] bg-[#0B27BC]/10 rounded-lg hover:bg-[#0B27BC]/20 transition-colors"
                  >
                    {linkCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        Tersalin
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Salin Link
                      </>
                    )}
                  </button>
                  <a
                    href={`/form/${event.checkin_code}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-white bg-[#0B27BC] rounded-lg hover:bg-[#091fa0] transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Buka
                  </a>
                </div>
              </div>
              <div className="px-3 py-2.5 bg-gray-50 rounded-lg border border-dashed border-border">
                <p className="text-xs text-muted-foreground font-mono break-all">
                  {typeof window !== "undefined"
                    ? `${window.location.origin}/form/${event.checkin_code}`
                    : `/form/${event.checkin_code}`}
                </p>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Bagikan link ini agar anggota bisa mendaftar kegiatan secara
                mandiri.
              </p>
            </div>
          )}

        {/* Attendance Count Card */}
        <div className="bg-white rounded-xl border border-border p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-[#FE8DA1]/20">
                  <Users className="w-5 h-5 text-[#84303F]" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {attendance.length}
                  </p>
                  <p className="text-xs text-muted-foreground">Total Hadir</p>
                </div>
              </div>
              {registrations.length > 0 && (
                <div className="pl-4 border-l border-border">
                  <p className="text-2xl font-bold text-[#0B27BC]">
                    {registrations.length}
                  </p>
                  <p className="text-xs text-muted-foreground">RSVP Hadir</p>
                </div>
              )}
            </div>
            {userCanEdit &&
              event.status !== "Dibatalkan" &&
              event.status !== "Selesai" && (
                <button
                  onClick={() => setShowCheckinForm((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-[#0B27BC] rounded-lg hover:bg-[#091fa0] transition-colors"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Check-in
                </button>
              )}
          </div>
        </div>

        {/* Check-in Form */}
        {showCheckinForm && (
          <div className="bg-white rounded-xl border border-border p-4 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                Check-in Anggota
              </h3>
              <button
                onClick={() => {
                  setShowCheckinForm(false);
                  setSelectedMember(null);
                  setMemberSearch("");
                  setCheckinCatatan("");
                }}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* RSVP Filter Toggle */}
            {registrations.length > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={() => { setCheckinFilter("all"); setSelectedMember(null); }}
                  className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                    checkinFilter === "all"
                      ? "bg-[#0B27BC] text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  Semua Anggota
                </button>
                <button
                  onClick={() => { setCheckinFilter("rsvp"); setSelectedMember(null); setMemberSearch(""); }}
                  className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                    checkinFilter === "rsvp"
                      ? "bg-[#0B27BC] text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  RSVP Hadir ({registrations.length})
                </button>
              </div>
            )}

            {/* Member Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={memberSearch}
                onChange={(e) => {
                  setMemberSearch(e.target.value);
                  setSelectedMember(null);
                }}
                placeholder={checkinFilter === "rsvp" ? "Cari dari daftar RSVP..." : "Cari nama anggota..."}
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC]"
              />
            </div>

            {/* Member List / Selected */}
            {selectedMember ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-[#0B27BC]/5 rounded-lg border border-[#0B27BC]/20">
                <Check className="w-4 h-4 text-[#0B27BC]" />
                <span className="text-sm font-medium text-foreground flex-1">
                  {selectedMember.nama}
                </span>
                <span className="text-xs text-muted-foreground">
                  TN{selectedMember.angkatan}
                </span>
                <button
                  onClick={() => setSelectedMember(null)}
                  className="p-1 rounded hover:bg-gray-200"
                >
                  <X className="w-3.5 h-3.5 text-gray-500" />
                </button>
              </div>
            ) : (
              (memberSearch.length > 0 || checkinFilter === "rsvp") && (
                <div className="max-h-48 overflow-y-auto border border-border rounded-lg divide-y divide-border">
                  {filteredMembers.length === 0 ? (
                    <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                      {checkinFilter === "rsvp"
                        ? "Semua anggota RSVP sudah check-in"
                        : "Tidak ada anggota ditemukan"}
                    </div>
                  ) : (
                    filteredMembers.slice(0, 20).map((member) => (
                      <button
                        key={member.id}
                        onClick={() => {
                          setSelectedMember(member);
                          setMemberSearch(member.nama);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 transition-colors"
                      >
                        <span className="text-sm text-foreground flex-1">
                          {member.nama}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          TN{member.angkatan}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )
            )}

            {/* Catatan */}
            <input
              type="text"
              value={checkinCatatan}
              onChange={(e) => setCheckinCatatan(e.target.value)}
              placeholder="Catatan (opsional)"
              className="w-full px-3 py-2.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC]"
            />

            <button
              onClick={handleCheckin}
              disabled={!selectedMember || checkinLoading}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-[#0B27BC] rounded-lg hover:bg-[#091fa0] transition-colors disabled:opacity-50"
            >
              {checkinLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
              Check-in Anggota
            </button>
          </div>
        )}

        {/* Attendance Table */}
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-[#0B27BC]" />
              Daftar Hadir
            </h3>
          </div>

          {attendance.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Belum ada yang hadir"
              description="Belum ada anggota yang melakukan check-in."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-gray-50/50">
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                      Nama
                    </th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">
                      Angkatan
                    </th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                      Waktu
                    </th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">
                      Catatan
                    </th>
                    {userCanEdit && (
                      <th className="text-right px-4 py-2.5 font-medium text-muted-foreground w-16">
                        Aksi
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {attendance.map((att) => (
                    <tr key={att.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-2.5">
                        <div>
                          <p className="font-medium text-foreground">
                            {att.member?.nama || "Anggota"}
                          </p>
                          <p className="text-xs text-muted-foreground sm:hidden">
                            TN{att.member?.angkatan}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 hidden sm:table-cell">
                        <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-[#0B27BC]/10 text-[#0B27BC]">
                          TN{att.member?.angkatan}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">
                        {new Date(att.checked_in_at).toLocaleString("id-ID", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs hidden sm:table-cell">
                        {att.catatan || "-"}
                      </td>
                      {userCanEdit && (
                        <td className="px-4 py-2.5 text-right">
                          <button
                            onClick={() => handleRemoveAttendance(att.id)}
                            disabled={removeLoading === att.id}
                            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                            title="Hapus check-in"
                          >
                            {removeLoading === att.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Hapus Kegiatan"
        message={`Apakah Anda yakin ingin menghapus kegiatan "${event.nama}"? Semua data absensi juga akan dihapus. Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel="Hapus Kegiatan"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        loading={deleteLoading}
      />
    </div>
  );
}
