import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getUserRole, canEdit } from "@/lib/roles";
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
 * GET /api/targets — Returns alumni list based on campaigner's assigned angkatan(s)
 * Falls back to legacy campaigner_targets if no angkatan assigned
 */
export async function GET() {
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

  const adminClient = getAdminClient();

  // 1. Get user's assigned angkatan(s)
  const { data: angkatanRows, error: angError } = await adminClient
    .from("campaigner_angkatan")
    .select("angkatan")
    .eq("user_id", user.id);

  if (angError) {
    return NextResponse.json({ error: angError.message }, { status: 500 });
  }

  const angkatanList = (angkatanRows || []).map((r: { angkatan: number }) => r.angkatan);

  // Fallback: legacy campaigner_targets if no angkatan assigned
  if (angkatanList.length === 0) {
    const { data: targets } = await adminClient
      .from("campaigner_targets")
      .select("member_id")
      .eq("user_id", user.id);

    if (!targets || targets.length === 0) {
      return NextResponse.json([]);
    }

    const memberIds = targets.map((t: { member_id: string }) => t.member_id);
    try {
      const members = await fetchAll(adminClient, "members", "*", (q) =>
        q.in("id", memberIds).order("no", { ascending: true })
      );

      // Derive masuk_grup from wa_group_members linkage
      const legacyWaLinked = new Set<string>();
      try {
        const waRows = await fetchAll(
          adminClient,
          "wa_group_members",
          "member_id",
          (q) => q.in("member_id", memberIds).not("member_id", "is", null)
        );
        for (const w of waRows) {
          if (w.member_id) legacyWaLinked.add(w.member_id);
        }
      } catch {
        // Continue without WA group data
      }

      // Get event attendance counts for legacy members
      const legacyAttCounts: Record<string, number> = {};
      try {
        const attRows = await fetchAll(
          adminClient,
          "event_attendance",
          "member_id",
          (q) => q.in("member_id", memberIds)
        );
        for (const a of attRows) {
          if (a.member_id) {
            legacyAttCounts[a.member_id] = (legacyAttCounts[a.member_id] || 0) + 1;
          }
        }
      } catch {
        // Continue without attendance data
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
      return NextResponse.json(legacyRows);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Failed to fetch members" },
        { status: 500 }
      );
    }
  }

  // 2. Fetch alumni for those angkatans
  let alumni;
  try {
    alumni = await fetchAll(
      adminClient,
      "alumni",
      "id, nama, angkatan, nosis, kelanjutan_studi, program_studi, keterangan",
      (q) => q.in("angkatan", angkatanList).order("angkatan").order("nama")
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch alumni" },
      { status: 500 }
    );
  }

  // 3. Get all alumni_ids, fetch linked members
  const alumniIds = alumni.map((a: { id: string }) => a.id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const membersMap: Record<string, any> = {};
  if (alumniIds.length > 0) {
    try {
      // Batch fetch in chunks of 500 to avoid URL length limits
      for (let i = 0; i < alumniIds.length; i += 500) {
        const chunk = alumniIds.slice(i, i + 500);
        const memberRows = await fetchAll(adminClient, "members", "*", (q) =>
          q.in("alumni_id", chunk)
        );
        for (const m of memberRows) {
          if (m.alumni_id) membersMap[m.alumni_id] = m;
        }
      }
    } catch {
      // Continue without member data
    }
  }

  // 3b. Derive masuk_grup from wa_group_members linkage
  const memberIds = Object.values(membersMap)
    .map((m) => m.id)
    .filter(Boolean) as string[];

  const waGroupLinkedIds = new Set<string>();
  if (memberIds.length > 0) {
    try {
      for (let i = 0; i < memberIds.length; i += 500) {
        const chunk = memberIds.slice(i, i + 500);
        const waRows = await fetchAll(
          adminClient,
          "wa_group_members",
          "member_id",
          (q) => q.in("member_id", chunk).not("member_id", "is", null)
        );
        for (const w of waRows) {
          if (w.member_id) waGroupLinkedIds.add(w.member_id);
        }
      }
    } catch {
      // Continue without WA group data
    }
  }

  // 3c. Get event attendance counts per member
  const attendanceCounts: Record<string, number> = {};
  if (memberIds.length > 0) {
    try {
      for (let i = 0; i < memberIds.length; i += 500) {
        const chunk = memberIds.slice(i, i + 500);
        const attRows = await fetchAll(
          adminClient,
          "event_attendance",
          "member_id",
          (q) => q.in("member_id", chunk)
        );
        for (const a of attRows) {
          if (a.member_id) {
            attendanceCounts[a.member_id] = (attendanceCounts[a.member_id] || 0) + 1;
          }
        }
      }
    } catch {
      // Continue without attendance data
    }
  }

  // 4. Combine: alumni with their member data (if exists)
  const combined = alumni.map((a: { id: string; nama: string; angkatan: number; nosis: string | null; kelanjutan_studi: string | null }) => {
    const member = membersMap[a.id];
    // masuk_grup is derived from wa_group_members linkage
    const inWaGroup = member?.id ? waGroupLinkedIds.has(member.id) : false;
    // If in WA group, they've been contacted
    const sudahDikontak = inWaGroup ? "Sudah" : (member?.sudah_dikontak || null);
    return {
      alumni_id: a.id,
      alumni_nama: a.nama,
      alumni_angkatan: a.angkatan,
      alumni_nosis: a.nosis,
      alumni_kelanjutan_studi: a.kelanjutan_studi,
      member_id: member?.id || null,
      no: member?.no || null,
      nama: member?.nama || a.nama,
      angkatan: member?.angkatan || a.angkatan,
      no_hp: member?.no_hp || "",
      status_dpt: member?.status_dpt || null,
      sudah_dikontak: sudahDikontak,
      masuk_grup: inWaGroup ? "Sudah" : "Belum",
      vote: member?.vote || null,
      dukungan: member?.dukungan || null,
      attendance_count: member?.id ? (attendanceCounts[member.id] || 0) : 0,
    };
  });

  return NextResponse.json(combined);
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
