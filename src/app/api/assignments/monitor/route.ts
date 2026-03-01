import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getUserRole, canManageUsers } from "@/lib/roles";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAll<T = any>(
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
 * GET /api/assignments/monitor — Returns all members with full campaign data
 * for admin monitoring view. Includes:
 * - All members with their alumni linkage
 * - Campaigner assignment info
 * - WA group status (derived)
 * - Event attendance counts
 * - Angkatan assignment info per campaigner
 */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const role = await getUserRole(supabase);

  if (!canManageUsers(role)) {
    return NextResponse.json(
      { error: "Tidak memiliki akses" },
      { status: 403 }
    );
  }

  const adminClient = getAdminClient();

  try {
    // 1. Fetch all members (only columns needed for monitoring)
    const members = await fetchAll(adminClient, "members", "id, alumni_id, nama, angkatan, no_hp, status_dpt, sudah_dikontak, vote, dukungan", (q) =>
      q.order("angkatan").order("nama")
    );

    if (members.length === 0) {
      return NextResponse.json({ members: [], campaigners: [] });
    }

    const memberIds = members.map((m) => m.id).filter(Boolean) as string[];

    // 2. Fetch campaigner_targets (legacy assignments) in parallel with other data
    const [targetRows, waRows, attRows, angkatanRows] = await Promise.all([
      // Campaigner targets
      fetchAll(adminClient, "campaigner_targets", "user_id, member_id"),
      // WA group members
      fetchAll(adminClient, "wa_group_members", "member_id", (q) =>
        q.not("member_id", "is", null)
      ),
      // Event attendance
      fetchAll(adminClient, "event_attendance", "member_id"),
      // Campaigner angkatan assignments
      fetchAll(adminClient, "campaigner_angkatan", "user_id, angkatan"),
    ]);

    // Build lookup maps
    // member_id -> user_id[] (campaigner assignments)
    const memberCampaignerMap: Record<string, string[]> = {};
    for (const t of targetRows) {
      if (!memberCampaignerMap[t.member_id]) memberCampaignerMap[t.member_id] = [];
      memberCampaignerMap[t.member_id].push(t.user_id);
    }

    // WA group linked member IDs
    const waGroupLinkedIds = new Set<string>();
    for (const w of waRows) {
      if (w.member_id) waGroupLinkedIds.add(w.member_id);
    }

    // Attendance counts
    const attendanceCounts: Record<string, number> = {};
    for (const a of attRows) {
      if (a.member_id) {
        attendanceCounts[a.member_id] = (attendanceCounts[a.member_id] || 0) + 1;
      }
    }

    // Angkatan -> user_id[] (which campaigners handle which angkatan)
    const angkatanCampaignerMap: Record<number, string[]> = {};
    // Reverse: user_id -> angkatan[] (for card display)
    const userAngkatanMap: Record<string, number[]> = {};
    for (const r of angkatanRows) {
      if (!angkatanCampaignerMap[r.angkatan]) angkatanCampaignerMap[r.angkatan] = [];
      angkatanCampaignerMap[r.angkatan].push(r.user_id);
      if (!userAngkatanMap[r.user_id]) userAngkatanMap[r.user_id] = [];
      userAngkatanMap[r.user_id].push(r.angkatan);
    }

    // 3. Get alumni data for linked members (parallel chunks)
    const alumniIds = [...new Set(members.map((m) => m.alumni_id).filter(Boolean) as string[])];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const alumniMap: Record<string, any> = {};
    if (alumniIds.length > 0) {
      const chunks: string[][] = [];
      for (let i = 0; i < alumniIds.length; i += 500) chunks.push(alumniIds.slice(i, i + 500));
      const results = await Promise.all(
        chunks.map((chunk) =>
          fetchAll(adminClient, "alumni", "id, nosis, kelanjutan_studi", (q) => q.in("id", chunk))
        )
      );
      for (const rows of results) {
        for (const a of rows) alumniMap[a.id] = a;
      }
    }

    // 4. Get campaigner info (emails)
    const allCampaignerIds = new Set<string>();
    for (const t of targetRows) allCampaignerIds.add(t.user_id);
    for (const r of angkatanRows) allCampaignerIds.add(r.user_id);

    const {
      data: { users },
    } = await adminClient.auth.admin.listUsers();

    const userEmailMap: Record<string, string> = {};
    for (const u of users || []) {
      userEmailMap[u.id] = u.email || u.id;
    }

    // 5. Build enriched member rows
    const enrichedMembers = members.map((m) => {
      const inWaGroup = waGroupLinkedIds.has(m.id);
      const sudahDikontak = inWaGroup ? "Sudah" : (m.sudah_dikontak || null);
      const alumni = m.alumni_id ? alumniMap[m.alumni_id] : null;

      // Get assigned campaigners (from legacy targets OR angkatan assignment)
      const legacyCampaigners = memberCampaignerMap[m.id] || [];
      const angkatanCampaigners = angkatanCampaignerMap[m.angkatan] || [];
      const allAssigned = [...new Set([...legacyCampaigners, ...angkatanCampaigners])];

      return {
        member_id: m.id,
        alumni_id: m.alumni_id || null,
        nama: m.nama,
        angkatan: m.angkatan,
        no_hp: m.no_hp || "",
        status_dpt: m.status_dpt || null,
        sudah_dikontak: sudahDikontak,
        masuk_grup: inWaGroup ? "Sudah" : "Belum",
        vote: m.vote || null,
        dukungan: m.dukungan || null,
        attendance_count: attendanceCounts[m.id] || 0,
        alumni_nosis: alumni?.nosis || null,
        alumni_kelanjutan_studi: alumni?.kelanjutan_studi || null,
        campaigner_ids: allAssigned,
        campaigner_emails: allAssigned.map((id) => userEmailMap[id] || id),
      };
    });

    // 6. Build campaigner list (with assigned angkatan)
    const campaignerList = Array.from(allCampaignerIds).map((id) => ({
      user_id: id,
      email: userEmailMap[id] || id,
      angkatan: (userAngkatanMap[id] || []).sort((a, b) => a - b),
    }));

    // 7. Get alumni count per angkatan (total alumni assigned, not just members)
    const allAngkatan = [...new Set(angkatanRows.map((r) => r.angkatan))];
    const alumniCountByAngkatan: Record<number, number> = {};
    if (allAngkatan.length > 0) {
      const alumniRows = await fetchAll(adminClient, "alumni", "angkatan", (q) =>
        q.in("angkatan", allAngkatan)
      );
      for (const a of alumniRows) {
        alumniCountByAngkatan[a.angkatan] = (alumniCountByAngkatan[a.angkatan] || 0) + 1;
      }
    }

    return NextResponse.json({
      members: enrichedMembers,
      campaigners: campaignerList,
      alumniCountByAngkatan,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch monitor data" },
      { status: 500 }
    );
  }
}
