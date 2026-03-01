import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

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

/* Lightweight member summary used for stats + filtering */
interface MemberSummary {
  id: string;
  alumni_id: string;
  no_hp: string | null;
  sudah_dikontak: string | null;
  dukungan: string | null;
  status_dpt: string | null;
  vote: string | null;
  masuk_grup: string; // derived from wa_group_members
}

/* Full alumni row returned per page */
interface AlumniWithMembers {
  id: string;
  nama: string;
  angkatan: number;
  nosis: string | null;
  kelanjutan_studi: string | null;
  program_studi: string | null;
  keterangan: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  members: any[];
}

/**
 * GET /api/alumni
 *
 * Optimized paginated alumni endpoint:
 *  - Fetches lightweight member summaries for stats + filtering
 *  - Derives masuk_grup from wa_group_members linkage (not DB column)
 *  - Only fetches full data + attendance for the requested page
 *
 * Query params:
 *   page, limit, search, angkatan, linked, multiLink,
 *   kontak, dukungan, grup, dpt, vote, phone, skipStats
 */
export async function GET(request: NextRequest) {
  await createSupabaseServerClient(); // auth check
  const { searchParams } = new URL(request.url);

  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.max(1, Math.min(200, parseInt(searchParams.get("limit") || "50")));
  const search = searchParams.get("search")?.trim() || "";
  const angkatan = searchParams.get("angkatan") || "";
  const linked = searchParams.get("linked") || "";
  const multiLink = searchParams.get("multiLink") === "true";
  const fKontak = searchParams.get("kontak") || "";
  const fDukungan = searchParams.get("dukungan") || "";
  const fGrup = searchParams.get("grup") || "";
  const fDpt = searchParams.get("dpt") || "";
  const fVote = searchParams.get("vote") || "";
  const fPhone = searchParams.get("phone") || "";
  const skipStats = searchParams.get("skipStats") === "true";

  try {
    // ── 1. Parallel lightweight fetches (stats + filtering + grup) ──
    const [allMembersRaw, waGroupLinks, allAlumniLite] = await Promise.all([
      // Members: only the fields we need for filtering/stats
      fetchAllRows(adminClient, "members", "id, alumni_id, no_hp, sudah_dikontak, dukungan, status_dpt, vote"),
      // WA group linkage: determines real "masuk_grup" status
      fetchAllRows(adminClient, "wa_group_members", "member_id", (q) =>
        q.not("member_id", "is", null)
      ),
      // Alumni: lightweight for filtering + pagination
      fetchAllRows(adminClient, "alumni", "id, nama, angkatan", (q) =>
        q.order("angkatan").order("nama")
      ),
    ]);

    // ── 2. Build WA group membership set ──
    const waLinkedMemberIds = new Set(
      (waGroupLinks || []).map((w: { member_id: string }) => w.member_id)
    );

    // ── 3. Build alumni_id → member summary map ──
    // Keep first member per alumni (primary); also count total members
    const memberByAlumni: Record<string, MemberSummary> = {};
    const memberCountByAlumni: Record<string, number> = {};

    for (const m of allMembersRaw || []) {
      if (!m.alumni_id) continue;
      memberCountByAlumni[m.alumni_id] = (memberCountByAlumni[m.alumni_id] || 0) + 1;
      if (!memberByAlumni[m.alumni_id]) {
        memberByAlumni[m.alumni_id] = {
          ...m,
          masuk_grup: waLinkedMemberIds.has(m.id) ? "Sudah" : "Belum",
        };
      }
    }

    // ── 4. Compute GLOBAL stats (before filters) — skipped when skipStats ──
    const allAlumni = allAlumniLite || [];
    let stats = null;
    let availableAngkatan = null;

    if (!skipStats) {
      const linkedAlumni = allAlumni.filter((a) => memberByAlumni[a.id]);
      stats = {
        total: allAlumni.length,
        linked: linkedAlumni.length,
        kontak: linkedAlumni.filter((a) => memberByAlumni[a.id].sudah_dikontak === "Sudah").length,
        dukung: linkedAlumni.filter((a) => {
          const d = memberByAlumni[a.id].dukungan;
          return d === "dukung" || d === "terkonvert";
        }).length,
        ragu: linkedAlumni.filter((a) => memberByAlumni[a.id].dukungan === "ragu_ragu").length,
        sebelah: linkedAlumni.filter((a) => memberByAlumni[a.id].dukungan === "milih_sebelah").length,
        grup: linkedAlumni.filter((a) => memberByAlumni[a.id].masuk_grup === "Sudah").length,
        multiLinked: allAlumni.filter((a) => (memberCountByAlumni[a.id] || 0) > 1).length,
      };

      // ── 5. Available angkatan for filter dropdown ──
      const angkatanSet = new Set<number>();
      allAlumni.forEach((a) => angkatanSet.add(a.angkatan));
      availableAngkatan = Array.from(angkatanSet).sort((a, b) => a - b);
    }

    // ── 6. Apply filters ──
    let filtered = allAlumni as { id: string; nama: string; angkatan: number }[];

    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter((item) => {
        const member = memberByAlumni[item.id];
        return (
          item.nama.toLowerCase().includes(q) ||
          (member?.no_hp && member.no_hp.includes(search))
        );
      });
    }

    if (angkatan) {
      const num = Number(angkatan);
      filtered = filtered.filter((item) => item.angkatan === num);
    }

    if (linked === "true") {
      filtered = filtered.filter((item) => !!memberByAlumni[item.id]);
    } else if (linked === "false") {
      filtered = filtered.filter((item) => !memberByAlumni[item.id]);
    }

    if (multiLink) {
      filtered = filtered.filter((item) => (memberCountByAlumni[item.id] || 0) > 1);
    }

    if (fPhone) {
      filtered = filtered.filter((item) => {
        const m = memberByAlumni[item.id];
        if (fPhone === "has") return m?.no_hp;
        if (fPhone === "empty") return !m?.no_hp;
        return true;
      });
    }

    if (fKontak) {
      filtered = filtered.filter((item) => {
        const val = memberByAlumni[item.id]?.sudah_dikontak || null;
        if (fKontak === "empty") return val === null;
        return val === fKontak;
      });
    }

    if (fDukungan) {
      filtered = filtered.filter((item) => {
        const val = memberByAlumni[item.id]?.dukungan || null;
        if (fDukungan === "pendukung") return val === "dukung" || val === "terkonvert";
        if (fDukungan === "empty") return !val;
        return val === fDukungan;
      });
    }

    if (fGrup) {
      filtered = filtered.filter((item) => {
        const val = memberByAlumni[item.id]?.masuk_grup || "Belum";
        return val === fGrup;
      });
    }

    if (fDpt) {
      filtered = filtered.filter((item) => {
        const val = memberByAlumni[item.id]?.status_dpt || null;
        if (fDpt === "empty") return val === null;
        return val === fDpt;
      });
    }

    if (fVote) {
      filtered = filtered.filter((item) => {
        const val = memberByAlumni[item.id]?.vote || null;
        if (fVote === "empty") return val === null;
        return val === fVote;
      });
    }

    // ── 7. Paginate (determine which alumni IDs we need) ──
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    const offset = (safePage - 1) * limit;
    const pageSlice = filtered.slice(offset, offset + limit);
    const pageIds = pageSlice.map((a) => a.id);

    // ── 8. Fetch ONLY the page's full alumni data with embedded members ──
    let pageData: AlumniWithMembers[] = [];
    if (pageIds.length > 0) {
      const { data, error } = await adminClient
        .from("alumni")
        .select(
          "id, nama, angkatan, nosis, kelanjutan_studi, program_studi, keterangan, members!alumni_id(id, no, nama, no_hp, pic, status_dpt, sudah_dikontak, masuk_grup, vote, dukungan)"
        )
        .in("id", pageIds);

      if (error) throw error;

      // Preserve sort order from filtered list
      const dataMap = new Map((data || []).map((d) => [d.id, d]));
      pageData = pageIds.map((id) => dataMap.get(id)!).filter(Boolean) as AlumniWithMembers[];
    }

    // ── 9. Fetch attendance counts ONLY for this page's members ──
    const pageMemberIds = pageData.flatMap((a) =>
      (a.members || []).map((m: { id: string }) => m.id)
    );
    const attendanceCounts: Record<string, number> = {};
    if (pageMemberIds.length > 0) {
      const { data: attData } = await adminClient
        .from("event_attendance")
        .select("member_id")
        .in("member_id", pageMemberIds);

      for (const a of attData || []) {
        if (a.member_id) {
          attendanceCounts[a.member_id] = (attendanceCounts[a.member_id] || 0) + 1;
        }
      }
    }

    // ── 10. Enrich page data: attendance + WA-group-derived masuk_grup ──
    for (const alumni of pageData) {
      alumni.members = (alumni.members || []).map((m: { id: string }) => ({
        ...m,
        attendance_count: attendanceCounts[m.id] || 0,
        // Override masuk_grup with WA group linkage (same as target page)
        masuk_grup: waLinkedMemberIds.has(m.id) ? "Sudah" : "Belum",
      }));
    }

    return NextResponse.json({
      data: pageData,
      total,
      page: safePage,
      limit,
      totalPages,
      stats,
      availableAngkatan,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch alumni" },
      { status: 500 }
    );
  }
}
