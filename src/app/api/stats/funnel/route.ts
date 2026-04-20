import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

/**
 * GET /api/stats/funnel
 *
 * Returns the 6-stage DPT funnel with dukungan overlay and per-angkatan data
 * for the dashboard, plus "next action" bucket counts used across pages.
 *
 * Stages:
 *   1. alumni      — total alumni (denominator for the funnel)
 *   2. contacted   — members with sudah_dikontak="Sudah" OR linked in wa_group_members
 *   3. formDpt     — members with isi_form_dpt="Sudah"
 *   4. webDpt      — members with registrasi_website_dpt="Sudah"
 *   5. dpt         — members with status_dpt="Sudah"
 *   6. vote        — members with vote="Sudah"
 *
 * Dukungan bucketing (applied on top of each stage's population):
 *   - dukung  = dukungan in {"dukung", "terkonvert"}
 *   - ragu    = dukungan = "ragu_ragu"
 *   - sebelah = dukungan = "milih_sebelah"
 *   - belum   = NULL / unknown
 *
 * NOTE: stages 2–6 use members as the base, since non-member alumni have no
 *       operational state. For stage 1 we only know alumni count.
 */

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

type Dukungan = "dukung" | "ragu" | "sebelah" | "belum";

function classifyDukungan(v: string | null | undefined): Dukungan {
  if (v === "dukung" || v === "terkonvert") return "dukung";
  if (v === "ragu_ragu") return "ragu";
  if (v === "milih_sebelah") return "sebelah";
  return "belum";
}

interface StageBucket {
  total: number;
  dukung: number;
  ragu: number;
  sebelah: number;
  belum: number;
}

function emptyStage(): StageBucket {
  return { total: 0, dukung: 0, ragu: 0, sebelah: 0, belum: 0 };
}

interface MemberRow {
  id: string;
  angkatan: number;
  sudah_dikontak: string | null;
  isi_form_dpt: string | null;
  registrasi_website_dpt: string | null;
  status_dpt: string | null;
  vote: string | null;
  dukungan: string | null;
}

interface AlumniRow {
  angkatan: number;
}

interface WaRow {
  member_id: string | null;
}

function addToBucket(bucket: StageBucket, d: Dukungan) {
  bucket.total++;
  bucket[d]++;
}

const STAGE_KEYS = [
  "alumni",
  "contacted",
  "formDpt",
  "webDpt",
  "dpt",
  "vote",
] as const;

type StageKey = (typeof STAGE_KEYS)[number];

export async function GET() {
  const adminClient = getAdminClient();

  try {
    const [alumniRows, memberRows, waRows] = await Promise.all([
      fetchAll<AlumniRow>(adminClient, "alumni", "angkatan"),
      fetchAll<MemberRow>(
        adminClient,
        "members",
        "id, angkatan, sudah_dikontak, isi_form_dpt, registrasi_website_dpt, status_dpt, vote, dukungan",
        (q) => q.not("is_non_alumni", "is", true)
      ),
      fetchAll<WaRow>(adminClient, "wa_group_members", "member_id", (q) =>
        q.not("member_id", "is", null)
      ),
    ]);

    const waLinked = new Set<string>();
    for (const w of waRows) if (w.member_id) waLinked.add(w.member_id);

    // Build per-angkatan and overall aggregates in a single pass
    const overall: Record<StageKey, StageBucket> = {
      alumni: emptyStage(),
      contacted: emptyStage(),
      formDpt: emptyStage(),
      webDpt: emptyStage(),
      dpt: emptyStage(),
      vote: emptyStage(),
    };

    const perAngkatan: Record<
      number,
      Record<StageKey, StageBucket>
    > = {};
    const ensureAngkatan = (a: number) => {
      if (!perAngkatan[a]) {
        perAngkatan[a] = {
          alumni: emptyStage(),
          contacted: emptyStage(),
          formDpt: emptyStage(),
          webDpt: emptyStage(),
          dpt: emptyStage(),
          vote: emptyStage(),
        };
      }
      return perAngkatan[a];
    };

    // Stage 1: alumni base (no dukungan info at this layer — all go to "belum")
    for (const a of alumniRows) {
      const pa = ensureAngkatan(a.angkatan);
      addToBucket(overall.alumni, "belum");
      addToBucket(pa.alumni, "belum");
    }

    // Next-action buckets (computed from member state, for deep links / priority)
    const nextActions = {
      dukungBelumKontak: 0,
      dukungBelumForm: 0,
      formBelumWeb: 0,
      webBelumDpt: 0,
      dptBelumVote: 0,
      belumKontak: 0,
      kontakBelumDukungan: 0,
    };

    for (const m of memberRows) {
      const d = classifyDukungan(m.dukungan);
      const pa = ensureAngkatan(m.angkatan);
      const contacted =
        m.sudah_dikontak === "Sudah" || waLinked.has(m.id);
      const form = m.isi_form_dpt === "Sudah";
      const web = m.registrasi_website_dpt === "Sudah";
      const dpt = m.status_dpt === "Sudah";
      const vote = m.vote === "Sudah";

      if (contacted) {
        addToBucket(overall.contacted, d);
        addToBucket(pa.contacted, d);
      }
      if (form) {
        addToBucket(overall.formDpt, d);
        addToBucket(pa.formDpt, d);
      }
      if (web) {
        addToBucket(overall.webDpt, d);
        addToBucket(pa.webDpt, d);
      }
      if (dpt) {
        addToBucket(overall.dpt, d);
        addToBucket(pa.dpt, d);
      }
      if (vote) {
        addToBucket(overall.vote, d);
        addToBucket(pa.vote, d);
      }

      // Next-action buckets: rows that got somewhere but stalled at the next step
      if (d === "dukung" && !contacted) nextActions.dukungBelumKontak++;
      if (d === "dukung" && !form) nextActions.dukungBelumForm++;
      if (form && !web) nextActions.formBelumWeb++;
      if (web && !dpt) nextActions.webBelumDpt++;
      if (dpt && !vote) nextActions.dptBelumVote++;
      if (!contacted) nextActions.belumKontak++;
      if (contacted && d === "belum") nextActions.kontakBelumDukungan++;
    }

    // Identify leakiest stage-to-stage transition (largest relative drop)
    const overallCounts: Record<StageKey, number> = {
      alumni: overall.alumni.total,
      contacted: overall.contacted.total,
      formDpt: overall.formDpt.total,
      webDpt: overall.webDpt.total,
      dpt: overall.dpt.total,
      vote: overall.vote.total,
    };

    const transitions = STAGE_KEYS.slice(1).map((to, i) => {
      const from = STAGE_KEYS[i];
      const fromCount = overallCounts[from];
      const toCount = overallCounts[to];
      const drop = Math.max(0, fromCount - toCount);
      const dropPct = fromCount > 0 ? (drop / fromCount) * 100 : 0;
      return { from, to, fromCount, toCount, drop, dropPct };
    });
    // "Leakiest" = largest drop count (more actionable than pct which punishes
    // stages that already have small bases like vote)
    const leakiest = transitions.reduce(
      (worst, t) => (t.drop > worst.drop ? t : worst),
      transitions[0]
    );

    // Shape per-angkatan output as a sorted array
    const perAngkatanArr = Object.entries(perAngkatan)
      .map(([angStr, stages]) => ({
        angkatan: Number(angStr),
        alumni: stages.alumni,
        contacted: stages.contacted,
        formDpt: stages.formDpt,
        webDpt: stages.webDpt,
        dpt: stages.dpt,
        vote: stages.vote,
      }))
      .sort((a, b) => a.angkatan - b.angkatan);

    return NextResponse.json({
      overall,
      transitions,
      leakiest,
      perAngkatan: perAngkatanArr,
      nextActions,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to fetch funnel stats",
      },
      { status: 500 }
    );
  }
}
