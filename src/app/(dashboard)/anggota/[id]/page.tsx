"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useRole } from "@/lib/RoleContext";
import { useToast } from "@/components/Toast";
import { MemberForm } from "@/components/MemberForm";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { AlumniLinkSelector } from "@/components/AlumniLinkSelector";
import {
  ArrowLeft,
  Loader2,
  Pencil,
  Trash2,
  Phone,
  Calendar,
  User,
  Users,
  CheckCircle,
  XCircle,
  Link2,
  MessageSquare,
  UserPlus,
  GraduationCap,
  Plus,
  X,
} from "lucide-react";
import type { Member, StatusValue, EventAttendance, Event } from "@/lib/types";

interface AlumniDetail {
  id: string;
  nama: string;
  angkatan: number;
  kelanjutan_studi: string | null;
  program_studi: string | null;
}

interface MemberWithAlumni extends Member {
  alumni?: AlumniDetail | null;
  campaigner_targets?: { user_id: string }[];
}

interface StatusToggleProps {
  label: string;
  value: StatusValue;
  canToggle: boolean;
  onToggle: () => void;
}

function StatusToggle({ label, value, canToggle, onToggle }: StatusToggleProps) {
  const isSudah = value === "Sudah";
  const isBelum = value === "Belum";

  return (
    <button
      onClick={canToggle ? onToggle : undefined}
      disabled={!canToggle}
      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all min-w-0 ${
        isSudah
          ? "bg-emerald-50 border-emerald-300 text-emerald-700"
          : isBelum
          ? "bg-red-50 border-red-300 text-red-700"
          : "bg-gray-50 border-gray-200 text-gray-400"
      } ${canToggle ? "cursor-pointer active:scale-95 hover:shadow-sm" : "cursor-default"}`}
    >
      {isSudah ? (
        <CheckCircle className="w-6 h-6" />
      ) : isBelum ? (
        <XCircle className="w-6 h-6" />
      ) : (
        <div className="w-6 h-6 rounded-full border-2 border-current" />
      )}
      <span className="text-xs font-semibold text-center leading-tight">{label}</span>
      <span className="text-[10px] font-medium">{value || "Belum diisi"}</span>
    </button>
  );
}

interface AttendanceWithEvent extends EventAttendance {
  event?: Event;
}

export default function MemberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { canEdit: userCanEdit, canDelete: userCanDelete, canManageUsers, role, userId } = useRole();
  const isCampaigner = role === "campaigner";
  const { showToast } = useToast();

  const [member, setMember] = useState<MemberWithAlumni | null>(null);
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [referredMembers, setReferredMembers] = useState<Member[]>([]);
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceWithEvent[]>([]);
  const [campaigners, setCampaigners] = useState<{ user_id: string; email: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [updatingField, setUpdatingField] = useState<string | null>(null);
  const [showAlumniLink, setShowAlumniLink] = useState(false);
  const [showAddCampaigner, setShowAddCampaigner] = useState(false);

  const isAssignedToMe = member?.campaigner_targets?.some(t => t.user_id === userId)
    || member?.assigned_to === userId;

  const handleAlumniLink = async (alumniId: string | null) => {
    if (!member) return;
    try {
      const res = await fetch(`/api/members/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alumni_id: alumniId }),
      });
      if (res.ok) {
        await fetchMember();
        showToast(
          alumniId ? "Berhasil dihubungkan dengan alumni" : "Hubungan alumni diputuskan",
          "success"
        );
        setShowAlumniLink(false);
      } else {
        const result = await res.json();
        showToast(result.error || "Gagal mengubah link alumni", "error");
      }
    } catch {
      showToast("Terjadi kesalahan jaringan", "error");
    }
  };

  const fetchMember = useCallback(async () => {
    const { data, error } = await supabase
      .from("members")
      .select("*, alumni:alumni_id(id, nama, angkatan, kelanjutan_studi, program_studi), campaigner_targets(user_id)")
      .eq("id", id)
      .single();

    if (error || !data) {
      showToast("Anggota tidak ditemukan", "error");
      router.push("/anggota");
      return;
    }

    setMember(data);
  }, [id, router, showToast]);

  const fetchAllMembers = useCallback(async () => {
    const { data } = await supabase
      .from("members")
      .select("*")
      .order("nama", { ascending: true });

    if (data) setAllMembers(data);
  }, []);

  const fetchReferralData = useCallback(async () => {
    if (!id) return;

    // Members referred by this member
    const { data: referred } = await supabase
      .from("members")
      .select("*")
      .eq("referred_by", id)
      .order("nama", { ascending: true });

    if (referred) setReferredMembers(referred);
  }, [id]);

  const fetchAttendance = useCallback(async () => {
    if (!id) return;

    const { data } = await supabase
      .from("event_attendance")
      .select("*, event:events(*)")
      .eq("member_id", id)
      .order("checked_in_at", { ascending: false });

    if (data) setAttendanceHistory(data);
  }, [id]);

  const fetchCampaigners = useCallback(async () => {
    if (!canManageUsers) return;
    try {
      const res = await fetch("/api/assignments");
      if (res.ok) {
        const data = await res.json();
        setCampaigners(data.campaigners || []);
      }
    } catch { /* ignore */ }
  }, [canManageUsers]);

  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      await Promise.all([fetchMember(), fetchAllMembers(), fetchReferralData(), fetchAttendance(), fetchCampaigners()]);
      setLoading(false);
    }
    loadAll();
  }, [fetchMember, fetchAllMembers, fetchReferralData, fetchAttendance, fetchCampaigners]);

  const handleAddAssignment = async (campaignerId: string) => {
    if (!member) return;
    try {
      const res = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaigner_id: campaignerId, member_ids: [member.id] }),
      });
      if (!res.ok) {
        showToast("Gagal menambah penugasan", "error");
      } else {
        showToast("Penugasan berhasil ditambahkan", "success");
        setShowAddCampaigner(false);
        await fetchMember();
      }
    } catch {
      showToast("Terjadi kesalahan jaringan", "error");
    }
  };

  const handleRemoveAssignment = async (campaignerId: string) => {
    if (!member) return;
    try {
      const res = await fetch("/api/assignments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaigner_id: campaignerId, member_ids: [member.id] }),
      });
      if (!res.ok) {
        showToast("Gagal menghapus penugasan", "error");
      } else {
        showToast("Penugasan berhasil dihapus", "success");
        await fetchMember();
      }
    } catch {
      showToast("Terjadi kesalahan jaringan", "error");
    }
  };

  const handleToggleStatus = async (field: string) => {
    if (!member || updatingField) return;

    const currentValue = member[field as keyof Member] as StatusValue;
    let newValue: StatusValue;
    if (currentValue === "Sudah") {
      newValue = "Belum";
    } else if (currentValue === "Belum") {
      newValue = null;
    } else {
      newValue = "Sudah";
    }

    setUpdatingField(field);
    setMember((prev) => (prev ? { ...prev, [field]: newValue } : prev));

    try {
      const res = await fetch("/api/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: member.id, field, value: newValue }),
      });

      if (!res.ok) {
        const result = await res.json();
        showToast(result.error || "Gagal mengubah status", "error");
        await fetchMember();
      } else {
        showToast("Status berhasil diubah", "success");
      }
    } catch {
      showToast("Terjadi kesalahan jaringan", "error");
      await fetchMember();
    } finally {
      setUpdatingField(null);
    }
  };

  const handleUpdateReferralName = async (name: string) => {
    if (!member) return;

    try {
      const res = await fetch("/api/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: member.id,
          field: "referral_name",
          value: name.trim() || null,
        }),
      });

      if (!res.ok) {
        const result = await res.json();
        showToast(result.error || "Gagal mengubah referral", "error");
      } else {
        showToast("Referral berhasil diubah", "success");
        setMember((prev) => (prev ? { ...prev, referral_name: name.trim() || null } : prev));
      }
    } catch {
      showToast("Terjadi kesalahan jaringan", "error");
    }
  };

  const handleSaveEdit = async (data: Partial<Member>) => {
    if (!member) return;

    const fields = ["nama", "angkatan", "no_hp", "pic", "referral_name"] as const;
    let hasError = false;

    for (const field of fields) {
      const newVal = data[field];
      const oldVal = member[field];
      if (newVal !== oldVal) {
        const res = await fetch("/api/members", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: member.id, field, value: newVal }),
        });

        if (!res.ok) {
          hasError = true;
          break;
        }
      }
    }

    if (hasError) {
      showToast("Gagal menyimpan perubahan", "error");
    } else {
      showToast("Data anggota berhasil diubah", "success");
      setEditMode(false);
      await fetchMember();
      await fetchReferralData();
    }
  };

  const handleDelete = async () => {
    if (!member) return;
    setDeleting(true);

    try {
      const res = await fetch(`/api/members/${member.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const result = await res.json();
        showToast(result.error || "Gagal menghapus anggota", "error");
        setDeleting(false);
        return;
      }

      showToast("Anggota berhasil dihapus", "success");
      router.push("/anggota");
    } catch {
      showToast("Terjadi kesalahan jaringan", "error");
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#0B27BC]" />
          <p className="text-sm text-muted-foreground">Memuat data anggota...</p>
        </div>
      </div>
    );
  }

  if (!member) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Anggota tidak ditemukan</p>
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
              onClick={() => router.push("/anggota")}
              className="p-1.5 -ml-1.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-white truncate">Detail Anggota</h1>
            </div>
            <div className="flex items-center gap-2">
              {userCanEdit && (!isCampaigner || isAssignedToMe) && (
                <button
                  onClick={() => setEditMode(!editMode)}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}
              {userCanDelete && !isCampaigner && (
                <button
                  onClick={() => setDeleteDialogOpen(true)}
                  className="p-2 rounded-lg hover:bg-red-500/20 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="h-1 bg-gradient-to-r from-[#fcb7c3] via-[#FE8DA1] to-[#fcb7c3]" />
      </header>

      <div className="px-4 sm:px-6 py-6 space-y-6 max-w-2xl mx-auto">
        {/* Edit Form */}
        {editMode ? (
          <MemberForm
            member={member}
            allMembers={allMembers}
            onSave={handleSaveEdit}
            onCancel={() => setEditMode(false)}
          />
        ) : (
          <>
            {/* Member Info Card */}
            <div className="bg-white rounded-xl border border-border p-5 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="shrink-0 w-12 h-12 rounded-full bg-[#0B27BC]/10 flex items-center justify-center">
                  <User className="w-6 h-6 text-[#0B27BC]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold text-foreground">{member.nama}</h2>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full bg-[#0B27BC]/10 text-[#0B27BC] text-xs font-semibold">
                      TN{member.angkatan}
                    </span>
                    <span className="text-xs text-muted-foreground">#{member.no}</span>
                    {userCanEdit ? (
                      <button
                        onClick={() => setShowAlumniLink(true)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                          member.alumni_id
                            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                        }`}
                      >
                        <GraduationCap className="w-3 h-3" />
                        {member.alumni_id ? "Terhubung Alumni" : "Hubungkan Alumni"}
                      </button>
                    ) : member.alumni_id ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">
                        <GraduationCap className="w-3 h-3" />
                        Terhubung Alumni
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs font-medium">
                        <GraduationCap className="w-3 h-3" />
                        Belum Terhubung Alumni
                      </span>
                    )}
                  </div>
                  <div className="mt-3 space-y-1.5">
                    {member.no_hp && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="w-3.5 h-3.5" />
                        <span className="font-mono">{member.no_hp}</span>
                      </div>
                    )}
                    {member.pic && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Users className="w-3.5 h-3.5" />
                        <span>PIC: {member.pic}</span>
                      </div>
                    )}
                    <div className="flex items-start gap-2 text-sm text-muted-foreground">
                      <UserPlus className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        {(() => {
                          const assignedIds = member.campaigner_targets?.map(t => t.user_id) || [];
                          const assignedCampaigners = campaigners.filter(c => assignedIds.includes(c.user_id));
                          const availableCampaigners = campaigners.filter(c => !assignedIds.includes(c.user_id));

                          if (canManageUsers) {
                            return (
                              <div className="flex flex-wrap items-center gap-1.5">
                                {assignedCampaigners.length === 0 && !showAddCampaigner && (
                                  <span className="text-sm text-muted-foreground">Belum ditugaskan</span>
                                )}
                                {assignedCampaigners.map((c) => (
                                  <span
                                    key={c.user_id}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#0B27BC]/10 text-[#0B27BC] text-xs font-medium"
                                  >
                                    {c.email.split("@")[0]}
                                    <button
                                      onClick={() => handleRemoveAssignment(c.user_id)}
                                      className="ml-0.5 p-0.5 rounded-full hover:bg-[#0B27BC]/20 transition-colors"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </span>
                                ))}
                                {showAddCampaigner ? (
                                  <select
                                    autoFocus
                                    value=""
                                    onChange={(e) => {
                                      if (e.target.value) handleAddAssignment(e.target.value);
                                    }}
                                    onBlur={() => setShowAddCampaigner(false)}
                                    className="px-2 py-0.5 text-xs border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC] bg-white"
                                  >
                                    <option value="">Pilih campaigner...</option>
                                    {availableCampaigners.map((c) => (
                                      <option key={c.user_id} value={c.user_id}>
                                        {c.email}
                                      </option>
                                    ))}
                                  </select>
                                ) : availableCampaigners.length > 0 ? (
                                  <button
                                    onClick={() => setShowAddCampaigner(true)}
                                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full border border-dashed border-[#0B27BC]/30 text-[#0B27BC] text-xs font-medium hover:bg-[#0B27BC]/5 transition-colors"
                                  >
                                    <Plus className="w-3 h-3" />
                                    Tambah
                                  </button>
                                ) : null}
                              </div>
                            );
                          }

                          // Read-only view for campaigners and others
                          return assignedCampaigners.length > 0 ? (
                            <div className="flex flex-wrap items-center gap-1.5">
                              {assignedCampaigners.map((c) => (
                                <span
                                  key={c.user_id}
                                  className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#0B27BC]/10 text-[#0B27BC] text-xs font-medium"
                                >
                                  {c.email.split("@")[0]}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span>Belum ditugaskan</span>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Status Toggles */}
            <div className="bg-white rounded-xl border border-border p-4 shadow-sm">
              <h3 className="font-semibold text-sm text-foreground mb-3">Status Keanggotaan</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatusToggle
                  label="Status DPT"
                  value={member.status_dpt}
                  canToggle={userCanEdit && (!isCampaigner || isAssignedToMe) && updatingField !== "status_dpt"}
                  onToggle={() => handleToggleStatus("status_dpt")}
                />
                <StatusToggle
                  label="Sudah Dikontak"
                  value={member.sudah_dikontak}
                  canToggle={userCanEdit && (!isCampaigner || isAssignedToMe) && updatingField !== "sudah_dikontak"}
                  onToggle={() => handleToggleStatus("sudah_dikontak")}
                />
                <StatusToggle
                  label="Masuk Grup"
                  value={member.masuk_grup}
                  canToggle={userCanEdit && (!isCampaigner || isAssignedToMe) && updatingField !== "masuk_grup"}
                  onToggle={() => handleToggleStatus("masuk_grup")}
                />
                <StatusToggle
                  label="Vote"
                  value={member.vote}
                  canToggle={userCanEdit && (!isCampaigner || isAssignedToMe) && updatingField !== "vote"}
                  onToggle={() => handleToggleStatus("vote")}
                />
              </div>
              {userCanEdit && (
                <p className="text-[10px] text-muted-foreground mt-2">
                  Ketuk untuk mengubah: Sudah &rarr; Belum &rarr; Kosong &rarr; Sudah
                </p>
              )}
            </div>

            {/* Alumni Link Card */}
            <div className="bg-white rounded-xl border border-border p-4 shadow-sm">
              <h3 className="font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-[#0B27BC]" />
                Data Alumni
              </h3>

              {member.alumni ? (
                <div className="space-y-3">
                  <div className="rounded-lg bg-emerald-50/60 border border-emerald-200/60 p-3.5">
                    <div className="flex items-start gap-3">
                      <div className="shrink-0 w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center">
                        <GraduationCap className="w-4.5 h-4.5 text-emerald-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">{member.alumni.nama}</p>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
                            TN {member.alumni.angkatan}
                          </span>
                          {member.alumni.kelanjutan_studi && (
                            <span className="text-xs text-muted-foreground">
                              {member.alumni.kelanjutan_studi}
                            </span>
                          )}
                        </div>
                        {member.alumni.program_studi && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {member.alumni.program_studi}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  {userCanEdit && (
                    <button
                      onClick={() => setShowAlumniLink(true)}
                      className="text-xs text-[#0B27BC] font-medium hover:underline"
                    >
                      Ubah atau putuskan hubungan alumni
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 gap-3">
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                    <GraduationCap className="w-6 h-6 text-gray-300" />
                  </div>
                  <p className="text-sm text-muted-foreground text-center">
                    Belum terhubung dengan data alumni
                  </p>
                  {userCanEdit && (
                    <button
                      onClick={() => setShowAlumniLink(true)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-[#0B27BC] rounded-lg hover:bg-[#0B27BC]/90 transition-colors"
                    >
                      <GraduationCap className="w-4 h-4" />
                      Hubungkan dengan Alumni
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Referral Section */}
            <div className="bg-white rounded-xl border border-border p-4 shadow-sm">
              <h3 className="font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
                <Link2 className="w-4 h-4 text-[#0B27BC]" />
                Referral
              </h3>

              {/* Referral name (free text) */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Direferensikan oleh
                </label>
                {userCanEdit ? (
                  <input
                    type="text"
                    defaultValue={member.referral_name || ""}
                    onBlur={(e) => {
                      const newVal = e.target.value.trim();
                      if (newVal !== (member.referral_name || "")) {
                        handleUpdateReferralName(newVal);
                      }
                    }}
                    placeholder="Ketik nama yang mereferensikan..."
                    className="w-full px-3 py-2.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC] bg-white"
                  />
                ) : (
                  <p className="text-sm text-foreground">
                    {member.referral_name || "Tidak ada"}
                  </p>
                )}
              </div>

              {/* Members referred by this member */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Anggota yang direferensikan ({referredMembers.length})
                </label>
                {referredMembers.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">
                    Belum ada anggota yang direferensikan
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {referredMembers.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => router.push(`/anggota/${m.id}`)}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors text-left"
                      >
                        <div className="w-7 h-7 rounded-full bg-[#FE8DA1]/10 flex items-center justify-center shrink-0">
                          <User className="w-3.5 h-3.5 text-[#FE8DA1]" />
                        </div>
                        <span className="text-sm font-medium text-foreground truncate">
                          {m.nama}
                        </span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          TN{m.angkatan}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Harapan untuk Ikastara */}
            {member.harapan && (
              <div className="bg-white rounded-xl border border-border p-4 shadow-sm">
                <h3 className="font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-[#0B27BC]" />
                  Harapan untuk Ikastara
                </h3>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {member.harapan}
                </p>
              </div>
            )}

            {/* Attendance History */}
            <div className="bg-white rounded-xl border border-border p-4 shadow-sm">
              <h3 className="font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#0B27BC]" />
                Riwayat Kehadiran ({attendanceHistory.length})
              </h3>

              {attendanceHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  Belum pernah menghadiri kegiatan
                </p>
              ) : (
                <div className="space-y-2">
                  {attendanceHistory.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-gray-50"
                    >
                      <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {a.event?.nama || "Kegiatan"}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(a.checked_in_at).toLocaleDateString("id-ID", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}{" "}
                          {new Date(a.checked_in_at).toLocaleTimeString("id-ID", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {a.catatan && (
                            <span className="ml-1 text-muted-foreground"> - {a.catatan}</span>
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Delete Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        title="Hapus Anggota"
        message={`Apakah Anda yakin ingin menghapus ${member.nama}? Data kehadiran dan referral terkait juga akan dihapus. Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel="Hapus"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteDialogOpen(false)}
        loading={deleting}
      />

      {/* Alumni Link Selector */}
      {showAlumniLink && (
        <AlumniLinkSelector
          currentAlumniId={member.alumni_id}
          memberName={member.nama}
          memberAngkatan={member.angkatan}
          onLink={handleAlumniLink}
          onClose={() => setShowAlumniLink(false)}
        />
      )}
    </div>
  );
}
