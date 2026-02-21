import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

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
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Total alumni count
  const { count: totalAlumni } = await adminClient
    .from("alumni")
    .select("id", { count: "exact", head: true });

  // Linked alumni count (members with alumni_id set)
  const { count: linkedAlumni } = await adminClient
    .from("members")
    .select("alumni_id", { count: "exact", head: true })
    .not("alumni_id", "is", null);

  // Alumni per angkatan — paginated fetch
  const angkatanCounts: Record<string, number> = {};
  try {
    const rows = await fetchAll<{ angkatan: number }>(
      adminClient, "alumni", "angkatan"
    );
    for (const row of rows) {
      const key = String(row.angkatan);
      angkatanCounts[key] = (angkatanCounts[key] || 0) + 1;
    }
  } catch {
    // If fetch fails, return empty angkatan data
  }

  return NextResponse.json({
    totalAlumni: totalAlumni || 0,
    linkedAlumni: linkedAlumni || 0,
    alumniByAngkatan: angkatanCounts,
  });
}
