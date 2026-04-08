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

export async function GET() {
  const adminClient = getAdminClient();

  try {
    const [alumniRows, memberRows, waRows, campaignerRows] = await Promise.all([
      fetchAll(adminClient, "alumni", "angkatan"),
      fetchAll(adminClient, "members",
        "angkatan, no_hp, sudah_dikontak, dukungan, status_dpt, vote, id",
        (q) => q.not("is_non_alumni", "is", true)
      ),
      fetchAll(adminClient, "wa_group_members", "member_id", (q) =>
        q.not("member_id", "is", null)
      ),
      fetchAll(adminClient, "campaigner_angkatan", "user_id, angkatan"),
    ]);

    const campaignerUserIds = [...new Set(campaignerRows.map((r: { user_id: string }) => r.user_id))];
    const userEmailMap: Record<string, string> = {};
    if (campaignerUserIds.length > 0) {
      const { data: { users } } = await adminClient.auth.admin.listUsers();
      for (const u of users || []) {
        userEmailMap[u.id] = u.email || u.id;
      }
    }

    const alumniByAngkatan: Record<number, number> = {};
    for (const a of alumniRows) {
      alumniByAngkatan[a.angkatan] = (alumniByAngkatan[a.angkatan] || 0) + 1;
    }

    const waLinked = new Set(
      waRows.map((w: { member_id: string }) => w.member_id)
    );

    const memberStats: Record<number, {
      hasPhone: number; contacted: number; dukung: number;
      ragu: number; sebelah: number; grupWa: number; dpt: number; vote: number;
    }> = {};

    for (const m of memberRows) {
      if (!memberStats[m.angkatan]) {
        memberStats[m.angkatan] = {
          hasPhone: 0, contacted: 0, dukung: 0,
          ragu: 0, sebelah: 0, grupWa: 0, dpt: 0, vote: 0,
        };
      }
      const s = memberStats[m.angkatan];
      if (m.no_hp && m.no_hp.trim() !== "") s.hasPhone++;
      if (m.sudah_dikontak === "Sudah") s.contacted++;
      if (m.dukungan === "dukung" || m.dukungan === "terkonvert") s.dukung++;
      if (m.dukungan === "ragu_ragu") s.ragu++;
      if (m.dukungan === "milih_sebelah") s.sebelah++;
      if (waLinked.has(m.id)) s.grupWa++;
      if (m.status_dpt === "Sudah") s.dpt++;
      if (m.vote === "Sudah") s.vote++;
    }

    const campaignersByAngkatan: Record<number, { user_id: string; email: string }[]> = {};
    for (const r of campaignerRows) {
      if (!campaignersByAngkatan[r.angkatan]) campaignersByAngkatan[r.angkatan] = [];
      campaignersByAngkatan[r.angkatan].push({
        user_id: r.user_id,
        email: userEmailMap[r.user_id] || r.user_id,
      });
    }

    const result = Object.entries(alumniByAngkatan)
      .map(([angkatanStr, totalAlumni]) => {
        const angkatan = Number(angkatanStr);
        const ms = memberStats[angkatan] || {
          hasPhone: 0, contacted: 0, dukung: 0,
          ragu: 0, sebelah: 0, grupWa: 0, dpt: 0, vote: 0,
        };
        return {
          angkatan,
          totalAlumni,
          ...ms,
          campaigners: campaignersByAngkatan[angkatan] || [],
        };
      })
      .sort((a, b) => a.angkatan - b.angkatan);

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch batch stats" },
      { status: 500 }
    );
  }
}
