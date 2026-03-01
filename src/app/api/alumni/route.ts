import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAllRows<T = any>(
  client: SupabaseClient,
  table: string,
  select: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  applyFilters?: (q: any) => any
): Promise<T[]> {
  const PAGE = 1000;
  let all: T[] = [];
  let from = 0;
  while (true) {
    let q = client.from(table).select(select).range(from, from + PAGE - 1);
    if (applyFilters) q = applyFilters(q);
    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) break;
    all = all.concat(data as T[]);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

/**
 * GET /api/alumni
 *
 * Returns ALL alumni with embedded members in a single response.
 * Frontend handles filtering, search, and pagination client-side.
 * This avoids per-page API calls and eliminates render glitches.
 */
export async function GET() {
  await createSupabaseServerClient(); // auth check

  try {
    // ── 1. Parallel fetches: full alumni + members + wa_group + attendance ──
    const [allAlumniData, allMembersRaw, waGroupLinks, allAttendance] = await Promise.all([
      // Full alumni data with all fields
      fetchAllRows(adminClient, "alumni",
        "id, nama, angkatan, nosis, kelanjutan_studi, program_studi, keterangan",
        (q) => q.order("angkatan").order("nama")
      ),
      // All members linked to alumni
      fetchAllRows(adminClient, "members",
        "id, alumni_id, no, nama, no_hp, pic, status_dpt, sudah_dikontak, vote, dukungan"
      ),
      // WA group linkage
      fetchAllRows(adminClient, "wa_group_members", "member_id", (q) =>
        q.not("member_id", "is", null)
      ),
      // Attendance counts
      fetchAllRows(adminClient, "event_attendance", "member_id"),
    ]);

    // ── 2. Build lookup maps ──
    const waLinkedMemberIds = new Set(
      (waGroupLinks || []).map((w: { member_id: string }) => w.member_id)
    );

    const attendanceCounts: Record<string, number> = {};
    for (const a of allAttendance || []) {
      if (a.member_id) attendanceCounts[a.member_id] = (attendanceCounts[a.member_id] || 0) + 1;
    }

    // Group members by alumni_id, enrich with masuk_grup + attendance
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const membersByAlumni: Record<string, any[]> = {};
    for (const m of allMembersRaw || []) {
      if (!m.alumni_id) continue;
      const enriched = {
        ...m,
        masuk_grup: waLinkedMemberIds.has(m.id) ? "Sudah" : "Belum",
        attendance_count: attendanceCounts[m.id] || 0,
      };
      if (!membersByAlumni[m.alumni_id]) membersByAlumni[m.alumni_id] = [];
      membersByAlumni[m.alumni_id].push(enriched);
    }

    // ── 3. Combine alumni + members ──
    const data = (allAlumniData || []).map((a) => ({
      ...a,
      members: membersByAlumni[a.id] || null,
    }));

    // ── 4. Compute stats ──
    const linkedAlumni = data.filter((a) => a.members && a.members.length > 0);
    const getPrimary = (a: typeof data[0]) => a.members?.[0];

    const stats = {
      total: data.length,
      linked: linkedAlumni.length,
      kontak: linkedAlumni.filter((a) => getPrimary(a)?.sudah_dikontak === "Sudah").length,
      dukung: linkedAlumni.filter((a) => {
        const d = getPrimary(a)?.dukungan;
        return d === "dukung" || d === "terkonvert";
      }).length,
      ragu: linkedAlumni.filter((a) => getPrimary(a)?.dukungan === "ragu_ragu").length,
      sebelah: linkedAlumni.filter((a) => getPrimary(a)?.dukungan === "milih_sebelah").length,
      grup: linkedAlumni.filter((a) => getPrimary(a)?.masuk_grup === "Sudah").length,
      multiLinked: data.filter((a) => (a.members?.length || 0) > 1).length,
    };

    // ── 5. Available angkatan ──
    const angkatanSet = new Set<number>();
    data.forEach((a) => angkatanSet.add(a.angkatan));
    const availableAngkatan = Array.from(angkatanSet).sort((a, b) => a - b);

    return NextResponse.json({ data, stats, availableAngkatan });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch alumni" },
      { status: 500 }
    );
  }
}
