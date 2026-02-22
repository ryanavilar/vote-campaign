"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useRole } from "@/lib/RoleContext";
import { useToast } from "@/components/Toast";
import { EmptyState } from "@/components/EmptyState";
import { EventForm } from "@/components/EventForm";
import {
  Loader2,
  Plus,
  Calendar,
  MapPin,
  Users,
  CalendarDays,
} from "lucide-react";
import type { Event } from "@/lib/types";

type StatusFilter = "Semua" | "Terjadwal" | "Berlangsung" | "Selesai";

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

export default function KegiatanPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("Semua");
  const { canManageUsers } = useRole();
  const { showToast } = useToast();
  const router = useRouter();

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/events");
      if (!res.ok) throw new Error("Gagal memuat kegiatan");
      const data = await res.json();
      setEvents(data);
    } catch {
      showToast("Gagal memuat data kegiatan", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const filteredEvents = useMemo(() => {
    if (statusFilter === "Semua") return events;
    return events.filter((e) => e.status === statusFilter);
  }, [events, statusFilter]);

  const handleEventCreated = (event: Event) => {
    setEvents((prev) => [event, ...prev]);
    setShowForm(false);
    showToast("Kegiatan berhasil dibuat", "success");
  };

  const statusTabs: StatusFilter[] = ["Semua", "Terjadwal", "Berlangsung", "Selesai"];

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

  return (
    <div className="bg-background">
      {/* Page Header */}
      <header className="sticky top-0 z-40 bg-[#0B27BC] text-white shadow-lg">
        <div className="px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-white">Kegiatan</h1>
              <p className="text-xs text-white/70">
                Kelola kegiatan dan absensi
              </p>
            </div>
            {canManageUsers && (
              <button
                onClick={() => setShowForm((prev) => !prev)}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-[#0B27BC] bg-white rounded-lg hover:bg-gray-100 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Buat Kegiatan</span>
              </button>
            )}
          </div>
        </div>
        <div className="h-1 bg-gradient-to-r from-[#fcb7c3] via-[#FE8DA1] to-[#fcb7c3]" />
      </header>

      <div className="px-4 sm:px-6 py-6 space-y-4">
        {/* Inline Create Form */}
        {showForm && (
          <EventForm
            onSave={handleEventCreated}
            onCancel={() => setShowForm(false)}
          />
        )}

        {/* Status Filter Tabs */}
        <div className="flex gap-1 bg-white rounded-xl border border-border p-1 shadow-sm overflow-x-auto">
          {statusTabs.map((tab) => {
            const count =
              tab === "Semua"
                ? events.length
                : events.filter((e) => e.status === tab).length;
            return (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`flex-1 min-w-fit px-3 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                  statusFilter === tab
                    ? "bg-[#0B27BC] text-white shadow-sm"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {tab} ({count})
              </button>
            );
          })}
        </div>

        {/* Event Cards */}
        {filteredEvents.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="Belum ada kegiatan"
            description={
              statusFilter === "Semua"
                ? "Buat kegiatan pertama untuk mulai mengelola absensi."
                : `Tidak ada kegiatan dengan status "${statusFilter}".`
            }
            action={
              canManageUsers && statusFilter === "Semua"
                ? { label: "Buat Kegiatan", onClick: () => setShowForm(true) }
                : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEvents.map((event) => (
              <button
                key={event.id}
                onClick={() => router.push(`/kegiatan/${event.id}`)}
                className="bg-white rounded-xl border border-border p-4 shadow-sm hover:shadow-md hover:border-[#0B27BC]/30 transition-all text-left w-full"
              >
                {/* Top row: jenis badge + status badge */}
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${JENIS_BADGE_COLORS[event.jenis]}`}
                  >
                    {event.jenis}
                  </span>
                  <span
                    className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_BADGE_COLORS[event.status]}`}
                  >
                    {event.status}
                  </span>
                </div>

                {/* Event name */}
                <h3 className="font-semibold text-foreground text-sm sm:text-base mb-2 line-clamp-2">
                  {event.nama}
                </h3>

                {/* Details */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{formatTanggal(event.tanggal)}</span>
                  </div>
                  {event.lokasi && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{event.lokasi}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Users className="w-3.5 h-3.5 shrink-0" />
                    <span>{event.attendance_count ?? 0} hadir</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
