"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Trophy, Users, Loader2, Medal } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { EngagementBadge } from "@/components/EngagementBadge";
import type { Member } from "@/lib/types";

interface MemberWithAttendance extends Member {
  attendance_count: number;
}

interface ReferralEntry {
  referrer_name: string;
  referrer_angkatan: number;
  referral_count: number;
  referred_names: string[];
}

type Tab = "loyalitas" | "referral";

function computeEngagementScore(
  member: MemberWithAttendance,
  referralCount: number
): number {
  let score = 0;
  if (member.status_dpt === "Sudah") score += 1;
  if (member.sudah_dikontak === "Sudah") score += 1;
  if (member.masuk_grup === "Sudah") score += 1;
  if (member.vote === "Sudah") score += 1;
  score += member.attendance_count * 2;
  score += referralCount;
  return score;
}

function getMedalEmoji(rank: number): string {
  if (rank === 1) return "\uD83E\uDD47";
  if (rank === 2) return "\uD83E\uDD48";
  if (rank === 3) return "\uD83E\uDD49";
  return "";
}

export default function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>("loyalitas");
  const [members, setMembers] = useState<MemberWithAttendance[]>([]);
  const [totalEvents, setTotalEvents] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);

      // Fetch all members
      const { data: membersData, error: membersError } = await supabase
        .from("members")
        .select("*")
        .order("nama", { ascending: true });

      if (membersError) {
        console.error("Error fetching members:", membersError);
        setLoading(false);
        return;
      }

      // Fetch total events count
      const { count: eventsCount } = await supabase
        .from("events")
        .select("*", { count: "exact", head: true });

      setTotalEvents(eventsCount || 0);

      // Fetch attendance counts per member
      const { data: attendanceData, error: attendanceError } = await supabase
        .from("event_attendance")
        .select("member_id");

      if (attendanceError) {
        console.error("Error fetching attendance:", attendanceError);
        setLoading(false);
        return;
      }

      // Count attendance per member
      const attendanceMap = new Map<string, number>();
      (attendanceData || []).forEach((row) => {
        const current = attendanceMap.get(row.member_id) || 0;
        attendanceMap.set(row.member_id, current + 1);
      });

      // Combine members with attendance counts
      const membersWithAttendance: MemberWithAttendance[] = (
        membersData || []
      ).map((member) => ({
        ...member,
        attendance_count: attendanceMap.get(member.id) || 0,
      }));

      setMembers(membersWithAttendance);
      setLoading(false);
    }

    fetchData();
  }, []);

  // Compute referral counts per member name
  const referralCountMap = useMemo(() => {
    const map = new Map<string, number>();
    members.forEach((m) => {
      if (m.referred_by) {
        const current = map.get(m.referred_by) || 0;
        map.set(m.referred_by, current + 1);
      }
    });
    return map;
  }, [members]);

  // Loyalitas data: members sorted by engagement score
  const loyalitasData = useMemo(() => {
    return members
      .map((member) => {
        const referralCount = referralCountMap.get(member.nama) || 0;
        const engagementScore = computeEngagementScore(member, referralCount);
        const attendanceRate =
          totalEvents > 0
            ? Math.round((member.attendance_count / totalEvents) * 100)
            : 0;
        return {
          ...member,
          engagementScore,
          attendanceRate,
          isSetia: totalEvents > 0 && member.attendance_count > totalEvents / 2,
        };
      })
      .sort((a, b) => b.engagementScore - a.engagementScore);
  }, [members, referralCountMap, totalEvents]);

  // Referral data: members grouped by referred_by
  const referralData = useMemo(() => {
    const referrerMap = new Map<
      string,
      { names: string[]; count: number }
    >();

    members.forEach((m) => {
      if (m.referred_by) {
        const existing = referrerMap.get(m.referred_by) || {
          names: [],
          count: 0,
        };
        existing.names.push(m.nama);
        existing.count += 1;
        referrerMap.set(m.referred_by, existing);
      }
    });

    const entries: ReferralEntry[] = [];
    referrerMap.forEach((value, referrerName) => {
      // Find the referrer member to get their angkatan
      const referrerMember = members.find((m) => m.nama === referrerName);
      entries.push({
        referrer_name: referrerName,
        referrer_angkatan: referrerMember?.angkatan || 0,
        referral_count: value.count,
        referred_names: value.names,
      });
    });

    return entries.sort((a, b) => b.referral_count - a.referral_count);
  }, [members]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#0B27BC]" />
          <p className="text-sm text-muted-foreground">
            Memuat leaderboard...
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
          <div className="flex items-center gap-3">
            <Trophy className="w-5 h-5 text-[#FE8DA1]" />
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-white">
                Leaderboard
              </h1>
              <p className="text-xs text-white/70">
                Peringkat anggota berdasarkan kontribusi
              </p>
            </div>
          </div>
        </div>
        <div className="h-1 bg-gradient-to-r from-[#fcb7c3] via-[#FE8DA1] to-[#fcb7c3]" />
      </header>

      <div className="px-4 sm:px-6 py-6 space-y-6">
        {/* Tab buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("loyalitas")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "loyalitas"
                ? "bg-[#0B27BC] text-white"
                : "bg-white text-gray-500 border border-border hover:bg-gray-50"
            }`}
          >
            <Trophy className="w-4 h-4" />
            Loyalitas
          </button>
          <button
            onClick={() => setActiveTab("referral")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "referral"
                ? "bg-[#0B27BC] text-white"
                : "bg-white text-gray-500 border border-border hover:bg-gray-50"
            }`}
          >
            <Users className="w-4 h-4" />
            Referral
          </button>
        </div>

        {/* Tab content */}
        {activeTab === "loyalitas" && (
          <LoyalitasTab data={loyalitasData} totalEvents={totalEvents} />
        )}
        {activeTab === "referral" && <ReferralTab data={referralData} />}
      </div>
    </div>
  );
}

/* ========================= Loyalitas Tab ========================= */

interface LoyalitasEntry extends MemberWithAttendance {
  engagementScore: number;
  attendanceRate: number;
  isSetia: boolean;
}

function LoyalitasTab({
  data,
  totalEvents,
}: {
  data: LoyalitasEntry[];
  totalEvents: number;
}) {
  if (data.length === 0) {
    return (
      <EmptyState
        icon={Trophy}
        title="Belum ada data"
        description="Belum ada anggota yang terdaftar untuk ditampilkan di leaderboard."
      />
    );
  }

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-gray-50/80">
              <th className="text-left px-4 py-3 font-semibold text-gray-600 w-12">
                #
              </th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">
                Nama
              </th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden sm:table-cell">
                TN
              </th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">
                Events
              </th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">
                Attendance
              </th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">
                Score
              </th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">
                Badge
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((entry, index) => {
              const rank = index + 1;
              const isTop3 = rank <= 3;
              const rowBg = isTop3
                ? rank === 1
                  ? "bg-amber-50/60"
                  : rank === 2
                    ? "bg-gray-50/60"
                    : "bg-orange-50/40"
                : "";

              return (
                <tr
                  key={entry.id}
                  className={`border-b border-border last:border-b-0 hover:bg-gray-50/50 transition-colors ${rowBg}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {isTop3 ? (
                        <span className="text-base">{getMedalEmoji(rank)}</span>
                      ) : (
                        <span className="text-gray-500 font-medium">
                          {rank}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">
                        {entry.nama}
                      </span>
                      {entry.isSetia && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                          Setia
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
                    TN{entry.angkatan}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600 hidden md:table-cell">
                    {entry.attendance_count}
                    {totalEvents > 0 && (
                      <span className="text-gray-400">/{totalEvents}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center hidden md:table-cell">
                    <span
                      className={`font-medium ${
                        entry.attendanceRate >= 75
                          ? "text-emerald-600"
                          : entry.attendanceRate >= 50
                            ? "text-amber-600"
                            : "text-gray-500"
                      }`}
                    >
                      {entry.attendanceRate}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-bold text-[#0B27BC]">
                      {entry.engagementScore}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <EngagementBadge
                      score={entry.engagementScore}
                      size="sm"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ========================= Referral Tab ========================= */

function ReferralTab({ data }: { data: ReferralEntry[] }) {
  if (data.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Belum ada referral"
        description="Belum ada anggota yang mereferensikan anggota lain."
      />
    );
  }

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-gray-50/80">
              <th className="text-left px-4 py-3 font-semibold text-gray-600 w-12">
                #
              </th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">
                Nama
              </th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden sm:table-cell">
                TN
              </th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">
                Referrals
              </th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">
                Referred Names
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((entry, index) => {
              const rank = index + 1;
              const isTop3 = rank <= 3;
              const rowBg = isTop3
                ? rank === 1
                  ? "bg-amber-50/60"
                  : rank === 2
                    ? "bg-gray-50/60"
                    : "bg-orange-50/40"
                : "";

              return (
                <tr
                  key={entry.referrer_name}
                  className={`border-b border-border last:border-b-0 hover:bg-gray-50/50 transition-colors ${rowBg}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {isTop3 ? (
                        <span className="text-base">{getMedalEmoji(rank)}</span>
                      ) : (
                        <span className="text-gray-500 font-medium">
                          {rank}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-foreground">
                      {entry.referrer_name}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
                    {entry.referrer_angkatan > 0
                      ? `TN${entry.referrer_angkatan}`
                      : "-"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#0B27BC]/10 text-[#0B27BC] font-bold text-sm">
                      {entry.referral_count}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {entry.referred_names.map((name) => (
                        <span
                          key={name}
                          className="inline-block text-xs px-2 py-0.5 rounded-full bg-[#FE8DA1]/10 text-[#84303F] font-medium"
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
