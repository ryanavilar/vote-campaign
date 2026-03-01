import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getUserRole, canEdit, canManageUsers } from "@/lib/roles";
import { logMemberAudit } from "@/lib/audit";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

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
 * Wraps target rows with optional pagination.
 * When `page` param is present → paginated JSON { data, total, page, limit, totalPages, availableAngkatan }
 * When absent → flat JSON array (backward compat for Target Saya page)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function maybePaginate(allRows: any[], sp: URLSearchParams): NextResponse {
  const pageParam = sp.get("page");

  // No pagination → flat array (backward compat)
  if (!pageParam) return NextResponse.json(allRows);

  // Server-side search
  const search = (sp.get("search") || "").trim().toLowerCase();
  const angkatanFilter = sp.get("angkatan") || "";
  let filtered = allRows;

  if (search) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    filtered = filtered.filter((r: any) =>
      (r.nama && r.nama.toLowerCase().includes(search)) ||
      (r.no_hp && r.no_hp.includes(search))
    );
  }
  if (angkatanFilter) {
    const num = Number(angkatanFilter);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    filtered = filtered.filter((r: any) => r.angkatan === num);
  }

  // Available angkatan from ALL rows (for dropdown)
  const angSet = new Set<number>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  allRows.forEach((r: any) => angSet.add(r.angkatan));
  const availableAngkatan = Array.from(angSet).sort((a, b) => a - b);

  const page = Math.max(1, parseInt(pageParam));
  const limit = Math.max(1, Math.min(200, parseInt(sp.get("limit") || "50")));
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * limit;

  return NextResponse.json({
    data: filtered.slice(offset, offset + limit),
    total,
    page: safePage,
    limit,
    totalPages,
    availableAngkatan,
  });
}

/**
 * GET /api/targets — Returns alumni list based on campaigner's assigned angkatan(s)
 * Falls back to legacy campaigner_targets if no angkatan assigned
 *
 * Query params:
 *   user_id  — (admin/super_admin only) impersonate a campaigner to view their targets
 *   page     — enable pagination (1-based)
 *   limit    — rows per page (default 50, max 200)
 *   search   — filter by nama / no_hp (server-side, requires page)
 *   angkatan — filter by angkatan number (server-side, requires page)
 */
export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const role = await getUserRole(supabase);

  if (!canEdit(role)) {
    return NextResponse.json(
      { error: "Tidak memiliki akses" },
      { status: 403 }
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Admin impersonation: if ?user_id= is provided and caller is admin/super_admin
  const { searchParams } = new URL(request.url);
  const impersonateUserId = searchParams.get("user_id");
  const targetUserId =
    impersonateUserId && canManageUsers(role) ? impersonateUserId : user.id;

  const adminClient = getAdminClient();

  // 1. Get target user's assigned angkatan(s)
  const { data: angkatanRows, error: angError } = await adminClient
    .from("campaigner_angkatan")
    .select("angkatan")
    .eq("user_id", targetUserId);

  if (angError) {
    return NextResponse.json({ error: angError.message }, { status: 500 });
  }

  const angkatanList = (angkatanRows || []).map((r: { angkatan: number }) => r.angkatan);

  // Fallback: legacy campaigner_targets if no angkatan assigned
  if (angkatanList.length === 0) {
    const { data: targets } = await adminClient
      .from("campaigner_targets")
      .select("member_id")
      .eq("user_id", targetUserId);

    if (!targets || targets.length === 0) {
      return maybePaginate([], searchParams);
    }

    const memberIds = targets.map((t: { member_id: string }) => t.member_id);
    try {
      // Fetch members + WA group + attendance in parallel
      const [members, waRows, attRows] = await Promise.all([
        fetchAll(adminClient, "members", "id, alumni_id, no, nama, angkatan, no_hp, status_dpt, sudah_dikontak, vote, dukungan", (q) =>
          q.in("id", memberIds).order("no", { ascending: true })
        ),
        fetchAll(adminClient, "wa_group_members", "member_id", (q) =>
          q.in("member_id", memberIds).not("member_id", "is", null)
        ).catch(() => []),
        fetchAll(adminClient, "event_attendance", "member_id", (q) =>
          q.in("member_id", memberIds)
        ).catch(() => []),
      ]);

      const legacyWaLinked = new Set<string>();
      for (const w of waRows) { if (w.member_id) legacyWaLinked.add(w.member_id); }

      const legacyAttCounts: Record<string, number> = {};
      for (const a of attRows) {
        if (a.member_id) legacyAttCounts[a.member_id] = (legacyAttCounts[a.member_id] || 0) + 1;
      }

      // Return in legacy format wrapped as target rows
      const legacyRows = members.map((m) => {
        const inGroup = legacyWaLinked.has(m.id);
        return {
          alumni_id: m.alumni_id || m.id,
          alumni_nama: m.nama,
          alumni_angkatan: m.angkatan,
          alumni_nosis: null,
          alumni_kelanjutan_studi: null,
          member_id: m.id,
          no: m.no,
          nama: m.nama,
          angkatan: m.angkatan,
          no_hp: m.no_hp || "",
          status_dpt: m.status_dpt,
          sudah_dikontak: inGroup ? "Sudah" : m.sudah_dikontak,
          masuk_grup: inGroup ? "Sudah" : "Belum",
          vote: m.vote,
          dukungan: m.dukungan || null,
          attendance_count: legacyAttCounts[m.id] || 0,
        };
      });
      return maybePaginate(legacyRows, searchParams);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Failed to fetch members" },
        { status: 500 }
      );
    }
  }

  // 2. Fetch lightweight alumni list for these angkatans (for filtering + pagination)
  let alumniLite: { id: string; nama: string; angkatan: number }[];
  try {
    alumniLite = await fetchAll(
      adminClient,
      "alumni",
      "id, nama, angkatan",
      (q) => q.in("angkatan", angkatanList).order("angkatan").order("nama")
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch alumni" },
      { status: 500 }
    );
  }

  // ── Non-paginated path: flat array (backward compat for Target Saya page) ──
  const pageParam = searchParams.get("page");
  if (!pageParam) {
    // Full fetch for legacy callers — same as before
    const alumniIds = alumniLite.map((a) => a.id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const membersMap: Record<string, any> = {};
    if (alumniIds.length > 0) {
      try {
        const chunks: string[][] = [];
        for (let i = 0; i < alumniIds.length; i += 500) chunks.push(alumniIds.slice(i, i + 500));
        const results = await Promise.all(
          chunks.map((chunk) => fetchAll(adminClient, "members", "id, alumni_id, no, nama, angkatan, no_hp, status_dpt, sudah_dikontak, vote, dukungan", (q) => q.in("alumni_id", chunk)))
        );
        for (const rows of results) {
          for (const m of rows) { if (m.alumni_id) membersMap[m.alumni_id] = m; }
        }
      } catch { /* continue */ }
    }
    const mIds = Object.values(membersMap).map((m) => m.id).filter(Boolean) as string[];
    const waLinked = new Set<string>();
    const attCounts: Record<string, number> = {};
    if (mIds.length > 0) {
      const mChunks: string[][] = [];
      for (let i = 0; i < mIds.length; i += 500) mChunks.push(mIds.slice(i, i + 500));
      const [waRes, attRes] = await Promise.all([
        Promise.all(mChunks.map((c) => fetchAll(adminClient, "wa_group_members", "member_id", (q) => q.in("member_id", c).not("member_id", "is", null)).catch(() => []))),
        Promise.all(mChunks.map((c) => fetchAll(adminClient, "event_attendance", "member_id", (q) => q.in("member_id", c)).catch(() => []))),
      ]);
      for (const rows of waRes) for (const w of rows) if (w.member_id) waLinked.add(w.member_id);
      for (const rows of attRes) for (const a of rows) if (a.member_id) attCounts[a.member_id] = (attCounts[a.member_id] || 0) + 1;
    }
    const flat = alumniLite.map((a) => {
      const member = membersMap[a.id];
      const inGroup = member?.id ? waLinked.has(member.id) : false;
      return {
        alumni_id: a.id, alumni_nama: a.nama, alumni_angkatan: a.angkatan,
        alumni_nosis: null, alumni_kelanjutan_studi: null,
        member_id: member?.id || null, no: member?.no || null,
        nama: member?.nama || a.nama, angkatan: member?.angkatan || a.angkatan,
        no_hp: member?.no_hp || "", status_dpt: member?.status_dpt || null,
        sudah_dikontak: inGroup ? "Sudah" : (member?.sudah_dikontak || null),
        masuk_grup: inGroup ? "Sudah" : "Belum",
        vote: member?.vote || null, dukungan: member?.dukungan || null,
        attendance_count: member?.id ? (attCounts[member.id] || 0) : 0,
      };
    });
    return NextResponse.json(flat);
  }

  // ── Paginated path: only fetch member data for the current page ──
  const search = (searchParams.get("search") || "").trim().toLowerCase();
  const angkatanFilter = searchParams.get("angkatan") || "";
  const page = Math.max(1, parseInt(pageParam));
  const limit = Math.max(1, Math.min(200, parseInt(searchParams.get("limit") || "50")));

  // Available angkatan (from lightweight list, cheap)
  const angSet = new Set<number>();
  alumniLite.forEach((a) => angSet.add(a.angkatan));
  const availableAngkatan = Array.from(angSet).sort((a, b) => a - b);

  // Apply search + angkatan filter on the lightweight list
  let filtered = alumniLite;
  if (angkatanFilter) {
    const num = Number(angkatanFilter);
    filtered = filtered.filter((a) => a.angkatan === num);
  }
  if (search) {
    filtered = filtered.filter((a) => a.nama.toLowerCase().includes(search));
  }

  // Paginate
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * limit;
  const pageSlice = filtered.slice(offset, offset + limit);
  const pageAlumniIds = pageSlice.map((a) => a.id);

  if (pageAlumniIds.length === 0) {
    return NextResponse.json({ data: [], total, page: safePage, limit, totalPages, availableAngkatan });
  }

  // Fetch full alumni data + members + wa_group + attendance ONLY for this page
  const [fullAlumniRes, pageMembers] = await Promise.all([
    adminClient
      .from("alumni")
      .select("id, nama, angkatan, nosis, kelanjutan_studi")
      .in("id", pageAlumniIds),
    fetchAll(adminClient, "members", "id, alumni_id, no, nama, angkatan, no_hp, status_dpt, sudah_dikontak, vote, dukungan", (q) =>
      q.in("alumni_id", pageAlumniIds)
    ).catch(() => []),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fullAlumniMap = new Map((fullAlumniRes.data || []).map((a: any) => [a.id, a]));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pageMembersMap: Record<string, any> = {};
  for (const m of pageMembers) { if (m.alumni_id) pageMembersMap[m.alumni_id] = m; }

  // Fetch wa_group + attendance only for page's member IDs
  const pageMemberIds = pageMembers.map((m) => m.id).filter(Boolean) as string[];
  const waGroupLinkedIds = new Set<string>();
  const attendanceCounts: Record<string, number> = {};

  if (pageMemberIds.length > 0) {
    const [waRows, attRows] = await Promise.all([
      fetchAll(adminClient, "wa_group_members", "member_id", (q) =>
        q.in("member_id", pageMemberIds).not("member_id", "is", null)
      ).catch(() => []),
      fetchAll(adminClient, "event_attendance", "member_id", (q) =>
        q.in("member_id", pageMemberIds)
      ).catch(() => []),
    ]);
    for (const w of waRows) { if (w.member_id) waGroupLinkedIds.add(w.member_id); }
    for (const a of attRows) {
      if (a.member_id) attendanceCounts[a.member_id] = (attendanceCounts[a.member_id] || 0) + 1;
    }
  }

  // Combine page results preserving sort order
  const data = pageSlice.map((a) => {
    const full = fullAlumniMap.get(a.id) || a;
    const member = pageMembersMap[a.id];
    const inWaGroup = member?.id ? waGroupLinkedIds.has(member.id) : false;
    return {
      alumni_id: a.id,
      alumni_nama: a.nama,
      alumni_angkatan: a.angkatan,
      alumni_nosis: full.nosis || null,
      alumni_kelanjutan_studi: full.kelanjutan_studi || null,
      member_id: member?.id || null,
      no: member?.no || null,
      nama: member?.nama || a.nama,
      angkatan: member?.angkatan || a.angkatan,
      no_hp: member?.no_hp || "",
      status_dpt: member?.status_dpt || null,
      sudah_dikontak: inWaGroup ? "Sudah" : (member?.sudah_dikontak || null),
      masuk_grup: inWaGroup ? "Sudah" : "Belum",
      vote: member?.vote || null,
      dukungan: member?.dukungan || null,
      attendance_count: member?.id ? (attendanceCounts[member.id] || 0) : 0,
    };
  });

  return NextResponse.json({ data, total, page: safePage, limit, totalPages, availableAngkatan });
}

/**
 * POST /api/targets — Create member for alumni + optional field update
 * Body: { alumni_id: string, field?: string, value?: string }
 */
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const role = await getUserRole(supabase);

  if (!canEdit(role)) {
    return NextResponse.json(
      { error: "Tidak memiliki akses" },
      { status: 403 }
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { alumni_id, field, value } = body;

  if (!alumni_id) {
    return NextResponse.json(
      { error: "alumni_id wajib diisi" },
      { status: 400 }
    );
  }

  const adminClient = getAdminClient();

  // Check if alumni exists
  const { data: alumni, error: alumniError } = await adminClient
    .from("alumni")
    .select("id, nama, angkatan")
    .eq("id", alumni_id)
    .single();

  if (alumniError || !alumni) {
    return NextResponse.json(
      { error: "Alumni tidak ditemukan" },
      { status: 404 }
    );
  }

  // Check if alumni already has a linked member
  const { data: existingMember } = await adminClient
    .from("members")
    .select("id, nama")
    .eq("alumni_id", alumni_id)
    .maybeSingle();

  let memberId: string;

  if (existingMember) {
    memberId = existingMember.id;

    // If member exists and field+value provided, update it
    if (field && value !== undefined) {
      const { data: updated, error: updateError } = await adminClient
        .from("members")
        .update({ [field]: value })
        .eq("id", memberId)
        .select()
        .single();

      if (updateError) {
        return NextResponse.json(
          { error: updateError.message },
          { status: 500 }
        );
      }

      await logMemberAudit(adminClient, {
        memberId,
        userId: user.id,
        userEmail: user.email || null,
        field,
        oldValue: null,
        newValue: String(value),
        action: "update",
      });

      return NextResponse.json({
        member_id: memberId,
        action: "updated",
        member: updated,
      });
    }

    // Just return existing member
    const { data: fullMember } = await adminClient
      .from("members")
      .select("*")
      .eq("id", memberId)
      .single();

    return NextResponse.json({
      member_id: memberId,
      action: "existing",
      member: fullMember,
    });
  }

  // Create new member from alumni data
  const { data: maxNoRow } = await adminClient
    .from("members")
    .select("no")
    .order("no", { ascending: false })
    .limit(1)
    .single();

  const nextNo = (maxNoRow?.no || 0) + 1;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const insertData: Record<string, any> = {
    no: nextNo,
    nama: alumni.nama,
    angkatan: alumni.angkatan,
    no_hp: "",
    alumni_id: alumni.id,
    status_dpt: null,
    sudah_dikontak: null,
    masuk_grup: null,
    vote: null,
    dukungan: null,
  };

  // If field + value provided, apply to insert directly
  if (field && value !== undefined) {
    insertData[field] = value;
  }

  const { data: newMember, error: insertError } = await adminClient
    .from("members")
    .insert(insertData)
    .select()
    .single();

  if (insertError) {
    return NextResponse.json(
      { error: insertError.message },
      { status: 500 }
    );
  }

  memberId = newMember.id;

  // Audit log: member created
  await logMemberAudit(adminClient, {
    memberId,
    userId: user.id,
    userEmail: user.email || null,
    field: "member",
    oldValue: null,
    newValue: `${alumni.nama} (TN${alumni.angkatan})`,
    action: "create",
  });

  if (field && value !== null && value !== undefined) {
    await logMemberAudit(adminClient, {
      memberId,
      userId: user.id,
      userEmail: user.email || null,
      field,
      oldValue: null,
      newValue: String(value),
      action: "update",
    });
  }

  return NextResponse.json(
    {
      member_id: memberId,
      action: "created",
      member: newMember,
    },
    { status: 201 }
  );
}

/**
 * DELETE /api/targets — Remove a member from campaigner's target list (legacy)
 * Body: { member_id: string }
 */
export async function DELETE(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const role = await getUserRole(supabase);

  if (!canEdit(role)) {
    return NextResponse.json(
      { error: "Tidak memiliki akses" },
      { status: 403 }
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { member_id } = body;

  if (!member_id) {
    return NextResponse.json(
      { error: "member_id wajib diisi" },
      { status: 400 }
    );
  }

  const adminClient = getAdminClient();

  const { error } = await adminClient
    .from("campaigner_targets")
    .delete()
    .eq("user_id", user.id)
    .eq("member_id", member_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logMemberAudit(adminClient, {
    memberId: member_id,
    userId: user.id,
    userEmail: user.email || null,
    field: "target",
    oldValue: user.email || user.id,
    newValue: null,
    action: "unassign",
  });

  return NextResponse.json({ success: true });
}
