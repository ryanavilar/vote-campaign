"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import { EmptyState } from "@/components/EmptyState";
import {
  ArrowLeft,
  Search,
  CheckCircle,
  Loader2,
  Radio,
  KeyRound,
  ChevronDown,
  ChevronUp,
  Users,
  UserCheck,
} from "lucide-react";
import type { Event, Member, EventAttendance } from "@/lib/types";

type CheckinView = "select" | "checkin";

export default function CheckinPage() {
  const [view, setView] = useState<CheckinView>("select");
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [attendance, setAttendance] = useState<EventAttendance[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  const [codeLoading, setCodeLoading] = useState(false);
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  // Fetch active events on mount
  useEffect(() => {
    fetchActiveEvents();
    fetchMembers();
  }, []);

  // Auto-focus search when entering checkin view
  useEffect(() => {
    if (view === "checkin" && searchRef.current) {
      setTimeout(() => searchRef.current?.focus(), 100);
    }
  }, [view]);

  const fetchActiveEvents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("status", "Berlangsung")
      .order("tanggal", { ascending: false });

    if (!error && data) {
      setEvents(data);
    }
    setLoading(false);
  };

  const fetchMembers = async () => {
    const { data, error } = await supabase
      .from("members")
      .select("*")
      .order("nama", { ascending: true });

    if (!error && data) {
      setMembers(data);
    }
  };

  const fetchAttendance = useCallback(async (eventId: string) => {
    const { data, error } = await supabase
      .from("event_attendance")
      .select("*, member:members(*)")
      .eq("event_id", eventId)
      .order("checked_in_at", { ascending: false });

    if (!error && data) {
      setAttendance(data);
    }
  }, []);

  const handleSelectEvent = async (event: Event) => {
    setSelectedEvent(event);
    setView("checkin");
    setSearchQuery("");
    await fetchAttendance(event.id);
  };

  const handleCodeSubmit = async () => {
    if (codeInput.length < 1) return;
    setCodeLoading(true);

    const { data: event, error } = await supabase
      .from("events")
      .select("*")
      .eq("checkin_code", codeInput.toUpperCase())
      .eq("status", "Berlangsung")
      .single();

    if (error || !event) {
      showToast("Kode check-in tidak valid atau kegiatan tidak berlangsung", "error");
      setCodeLoading(false);
      return;
    }

    setCodeLoading(false);
    await handleSelectEvent(event);
  };

  const handleCheckin = async (memberId: string) => {
    if (!selectedEvent?.checkin_code || checkingIn) return;

    setCheckingIn(memberId);
    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkin_code: selectedEvent.checkin_code,
          member_id: memberId,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        showToast(result.error || "Gagal check-in", "error");
        return;
      }

      showToast(result.message || "Berhasil check-in!", "success");
      await fetchAttendance(selectedEvent.id);
    } catch {
      showToast("Terjadi kesalahan jaringan", "error");
    } finally {
      setCheckingIn(null);
    }
  };

  const handleAddNote = async (attendanceId: string) => {
    if (!noteText.trim()) return;

    const { error } = await supabase
      .from("event_attendance")
      .update({ catatan: noteText.trim() })
      .eq("id", attendanceId);

    if (error) {
      showToast("Gagal menambah catatan", "error");
    } else {
      showToast("Catatan ditambahkan", "success");
      if (selectedEvent) {
        await fetchAttendance(selectedEvent.id);
      }
    }
    setNoteText("");
    setExpandedMember(null);
  };

  const handleBack = () => {
    setView("select");
    setSelectedEvent(null);
    setAttendance([]);
    setSearchQuery("");
  };

  const checkedInIds = useMemo(
    () => new Set(attendance.map((a) => a.member_id)),
    [attendance]
  );

  const attendanceMap = useMemo(() => {
    const map = new Map<string, EventAttendance>();
    attendance.forEach((a) => map.set(a.member_id, a));
    return map;
  }, [attendance]);

  const filteredMembers = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const filtered = members.filter(
      (m) =>
        m.nama.toLowerCase().includes(q) ||
        (m.no_hp && m.no_hp.includes(searchQuery))
    );

    // Sort: not checked in first, then checked in
    return filtered.sort((a, b) => {
      const aChecked = checkedInIds.has(a.id);
      const bChecked = checkedInIds.has(b.id);
      if (aChecked === bChecked) return a.nama.localeCompare(b.nama);
      return aChecked ? 1 : -1;
    });
  }, [members, searchQuery, checkedInIds]);

  // === EVENT SELECTION VIEW ===
  if (view === "select") {
    return (
      <div className="bg-background min-h-screen">
        <header className="sticky top-0 z-40 bg-[#0B27BC] text-white shadow-lg">
          <div className="px-4 sm:px-6 py-3">
            <h1 className="text-lg sm:text-xl font-bold text-white">Check-in</h1>
            <p className="text-xs text-white/70">Pilih kegiatan atau masukkan kode</p>
          </div>
          <div className="h-1 bg-gradient-to-r from-[#fcb7c3] via-[#FE8DA1] to-[#fcb7c3]" />
        </header>

        <div className="px-4 sm:px-6 py-6 space-y-6 max-w-lg mx-auto">
          {/* Manual code input */}
          <div className="bg-white rounded-xl border border-border p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <KeyRound className="w-4 h-4 text-[#0B27BC]" />
              <h3 className="font-semibold text-sm text-foreground">Masukkan Kode Check-in</h3>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                placeholder="Contoh: ABC123"
                maxLength={6}
                className="flex-1 px-4 py-3 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC] uppercase tracking-widest font-mono text-center text-lg"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCodeSubmit();
                }}
              />
              <button
                onClick={handleCodeSubmit}
                disabled={codeInput.length < 1 || codeLoading}
                className="px-5 py-3 text-sm font-medium text-white bg-[#0B27BC] rounded-lg hover:bg-[#091fa0] transition-colors disabled:opacity-50 shrink-0"
              >
                {codeLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Cari"}
              </button>
            </div>
          </div>

          {/* Active events */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Radio className="w-4 h-4 text-[#FE8DA1]" />
              <h3 className="font-semibold text-sm text-foreground">Kegiatan Berlangsung</h3>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-[#0B27BC]" />
              </div>
            ) : events.length === 0 ? (
              <EmptyState
                title="Tidak ada kegiatan berlangsung"
                description="Belum ada kegiatan dengan status berlangsung saat ini"
              />
            ) : (
              <div className="space-y-3">
                {events.map((event) => (
                  <button
                    key={event.id}
                    onClick={() => handleSelectEvent(event)}
                    className="w-full text-left bg-white rounded-xl border border-border p-4 shadow-sm hover:border-[#0B27BC]/30 hover:shadow-md transition-all active:scale-[0.98]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-foreground truncate">
                          {event.nama}
                        </h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {event.jenis}
                          {event.lokasi ? ` - ${event.lokasi}` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(event.tanggal).toLocaleDateString("id-ID", {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                      <div className="shrink-0">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">
                          <Radio className="w-3 h-3" />
                          Live
                        </span>
                      </div>
                    </div>
                    {event.checkin_code && (
                      <div className="mt-2 pt-2 border-t border-border">
                        <span className="text-xs text-muted-foreground">Kode: </span>
                        <span className="text-xs font-mono font-bold text-[#0B27BC]">
                          {event.checkin_code}
                        </span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // === CHECK-IN VIEW ===
  return (
    <div className="bg-background min-h-screen">
      <header className="sticky top-0 z-40 bg-[#0B27BC] text-white shadow-lg">
        <div className="px-4 sm:px-6 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className="p-1.5 -ml-1.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-white truncate">
                {selectedEvent?.nama}
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <UserCheck className="w-3.5 h-3.5 text-white/70" />
                <span className="text-xs text-white/70">
                  {attendance.length} / {members.length} check-in
                </span>
              </div>
            </div>
            <div className="shrink-0 bg-white/10 rounded-lg px-3 py-1.5">
              <span className="text-2xl font-bold tabular-nums">
                {attendance.length}
              </span>
            </div>
          </div>
        </div>
        <div className="h-1 bg-gradient-to-r from-[#fcb7c3] via-[#FE8DA1] to-[#fcb7c3]" />

        {/* Search bar - inside header for sticky */}
        <div className="bg-white px-4 sm:px-6 py-3 border-b border-border">
          <div className="relative max-w-lg mx-auto">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama anggota..."
              className="w-full pl-11 pr-4 py-3.5 text-base border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC]"
            />
          </div>
        </div>
      </header>

      {/* Member list */}
      <div className="max-w-lg mx-auto">
        {/* Quick stats bar */}
        <div className="px-4 sm:px-6 py-2 flex items-center gap-4 text-xs text-muted-foreground border-b border-border bg-white">
          <div className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            <span>{filteredMembers.length} anggota</span>
          </div>
          <div className="flex items-center gap-1 text-emerald-600">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>{attendance.length} hadir</span>
          </div>
        </div>

        <div className="divide-y divide-border">
          {filteredMembers.map((member) => {
            const isCheckedIn = checkedInIds.has(member.id);
            const attendanceRecord = attendanceMap.get(member.id);
            const isExpanded = expandedMember === member.id;
            const isLoading = checkingIn === member.id;

            return (
              <div key={member.id} className="bg-white">
                <button
                  onClick={() => {
                    if (isCheckedIn) {
                      setExpandedMember(isExpanded ? null : member.id);
                      if (attendanceRecord?.catatan) {
                        setNoteText(attendanceRecord.catatan);
                      } else {
                        setNoteText("");
                      }
                    } else {
                      handleCheckin(member.id);
                    }
                  }}
                  disabled={isLoading}
                  className={`w-full flex items-center gap-3 px-4 sm:px-6 min-h-[3rem] py-3 text-left transition-colors active:bg-gray-50 ${
                    isCheckedIn ? "bg-emerald-50/50" : "hover:bg-[#0B27BC]/[0.02]"
                  }`}
                >
                  {/* Status indicator */}
                  <div className="shrink-0">
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin text-[#0B27BC]" />
                    ) : isCheckedIn ? (
                      <CheckCircle className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
                    )}
                  </div>

                  {/* Name and badge */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-medium truncate ${
                          isCheckedIn
                            ? "text-emerald-700"
                            : "text-foreground"
                        }`}
                      >
                        {member.nama}
                      </span>
                      <span className="shrink-0 inline-flex items-center justify-center px-1.5 py-0.5 rounded-full bg-[#0B27BC]/10 text-[#0B27BC] text-[10px] font-medium">
                        TN{member.angkatan}
                      </span>
                    </div>
                    {isCheckedIn && attendanceRecord && (
                      <p className="text-[10px] text-emerald-600 mt-0.5">
                        Check-in{" "}
                        {new Date(attendanceRecord.checked_in_at).toLocaleTimeString(
                          "id-ID",
                          { hour: "2-digit", minute: "2-digit" }
                        )}
                        {attendanceRecord.catatan && (
                          <span className="ml-1 text-muted-foreground">
                            - {attendanceRecord.catatan}
                          </span>
                        )}
                      </p>
                    )}
                  </div>

                  {/* Expand toggle for checked-in members */}
                  {isCheckedIn && (
                    <div className="shrink-0">
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                  )}
                </button>

                {/* Expandable note section */}
                {isCheckedIn && isExpanded && attendanceRecord && (
                  <div className="px-4 sm:px-6 pb-3 pl-12">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="Tambah catatan..."
                        className="flex-1 px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC]"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleAddNote(attendanceRecord.id);
                          }
                        }}
                      />
                      <button
                        onClick={() => handleAddNote(attendanceRecord.id)}
                        disabled={!noteText.trim()}
                        className="px-3 py-2 text-xs font-medium text-white bg-[#0B27BC] rounded-lg hover:bg-[#091fa0] transition-colors disabled:opacity-50"
                      >
                        Simpan
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {filteredMembers.length === 0 && (
          <div className="py-12">
            <EmptyState
              icon={Search}
              title="Tidak ditemukan"
              description={`Tidak ada anggota dengan nama "${searchQuery}"`}
            />
          </div>
        )}
      </div>
    </div>
  );
}
