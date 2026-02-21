import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET() {
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Run all three queries in PARALLEL for speed
  const [totalRes, linkedRes, angkatanRes] = await Promise.all([
    // 1. Total alumni count (fast — head-only)
    adminClient
      .from("alumni")
      .select("id", { count: "exact", head: true }),

    // 2. Distinct alumni IDs linked to members (fetch alumni_id column, deduplicate client-side)
    adminClient
      .from("members")
      .select("alumni_id")
      .not("alumni_id", "is", null),

    // 3. Alumni per angkatan — use Supabase RPC or paginated fetch
    //    We'll do a single paginated fetch of just the angkatan column
    fetchAngkatanCounts(adminClient),
  ]);

  const totalAlumni = totalRes.count || 0;

  // Count distinct alumni_id values (not raw member count)
  const distinctLinked = new Set(
    (linkedRes.data || []).map((r: { alumni_id: string }) => r.alumni_id)
  ).size;

  return NextResponse.json({
    totalAlumni,
    linkedAlumni: distinctLinked,
    alumniByAngkatan: angkatanRes,
  });
}

async function fetchAngkatanCounts(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any
): Promise<Record<string, number>> {
  const PAGE = 1000;
  const counts: Record<string, number> = {};

  try {
    let from = 0;
    while (true) {
      const { data, error } = await client
        .from("alumni")
        .select("angkatan")
        .range(from, from + PAGE - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;

      for (const row of data) {
        const key = String(row.angkatan);
        counts[key] = (counts[key] || 0) + 1;
      }

      if (data.length < PAGE) break;
      from += PAGE;
    }
  } catch {
    // If fetch fails, return whatever we have so far
  }

  return counts;
}
