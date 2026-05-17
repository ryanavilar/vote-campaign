import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface VoteCounts {
  totalDpt: number;
  vote1: number;       // pilih kita
  vote2: number;       // pilih sebelah
  voteTT: number;      // sudah vote tapi tidak tahu pilihannya
  belumVote: number;   // DPT tapi belum vote
  perAngkatan: Array<{ angkatan: number; total: number; vote1: number; vote2: number; voteTT: number; belum: number }>;
}

export async function GET() {
  const sb = getAdminClient();
  let mem: Array<{ angkatan: number; status_dpt: string | null; vote: string | null; is_non_alumni: boolean | null }> = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from("members")
      .select("angkatan, status_dpt, vote, is_non_alumni")
      .range(from, from + 999);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data?.length) break;
    mem = mem.concat(data);
    if (data.length < 1000) break;
  }
  mem = mem.filter((m) => m.is_non_alumni !== true && m.status_dpt === "Sudah");

  const out: VoteCounts = { totalDpt: mem.length, vote1: 0, vote2: 0, voteTT: 0, belumVote: 0, perAngkatan: [] };
  const byAng = new Map<number, { total: number; vote1: number; vote2: number; voteTT: number; belum: number }>();
  for (const m of mem) {
    const ang = m.angkatan;
    if (!byAng.has(ang)) byAng.set(ang, { total: 0, vote1: 0, vote2: 0, voteTT: 0, belum: 0 });
    const e = byAng.get(ang)!;
    e.total++;
    if (m.vote === "1") { out.vote1++; e.vote1++; }
    else if (m.vote === "2") { out.vote2++; e.vote2++; }
    else if (m.vote === "TT") { out.voteTT++; e.voteTT++; }
    else { out.belumVote++; e.belum++; }
  }
  out.perAngkatan = [...byAng.entries()]
    .map(([angkatan, v]) => ({ angkatan, ...v }))
    .sort((a, b) => a.angkatan - b.angkatan);
  return NextResponse.json(out);
}
