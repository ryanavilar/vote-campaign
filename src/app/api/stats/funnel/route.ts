import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { classifyTier, type DptTier } from "@/lib/dptDeadline";

/**
 * GET /api/stats/funnel
 *
 * Returns the 6-stage DPT funnel (with dukungan overlay) plus per-angkatan data,
 * next-action buckets, and DPT-centric metrics for the dashboard.
 *
 * Stages (all use the members table, non-alumni excluded, as the base):
 *   1. terdata    — alumni with a member row (i.e. ever entered into the system)
 *   2. contacted  — sudah_dikontak="Sudah" OR linked in wa_group_members
 *   3. formDpt    — isi_form_dpt="Sudah"
 *   4. webDpt     — registrasi_website_dpt="Sudah"
 *   5. dpt        — status_dpt="Sudah"
 *   6. vote       — vote="Sudah"
 *
 * NOTE: stage 1 used to be total-alumni which made the "leak" from alumni→contacted
 * misleading (most of that drop is just data-entry work that never happened). Using
 * the members table as the denominator gives a true operational funnel. Total alumni
 * and coverage (alumni→members %) are surfaced separately as context.
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
  no_hp: string | null;
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
  "terdata",
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
        "id, angkatan, no_hp, sudah_dikontak, isi_form_dpt, registrasi_website_dpt, status_dpt, vote, dukungan",
        (q) => q.not("is_non_alumni", "is", true)
      ),
      fetchAll<WaRow>(adminClient, "wa_group_members", "member_id", (q) =>
        q.not("member_id", "is", null)
      ),
    ]);

    const waLinked = new Set<string>();
    for (const w of waRows) if (w.member_id) waLinked.add(w.member_id);

    const overall: Record<StageKey, StageBucket> = {
      terdata: emptyStage(),
      contacted: emptyStage(),
      formDpt: emptyStage(),
      webDpt: emptyStage(),
      dpt: emptyStage(),
      vote: emptyStage(),
    };

    const perAngkatan: Record<number, Record<StageKey, StageBucket>> = {};
    const ensureAngkatan = (a: number) => {
      if (!perAngkatan[a]) {
        perAngkatan[a] = {
          terdata: emptyStage(),
          contacted: emptyStage(),
          formDpt: emptyStage(),
          webDpt: emptyStage(),
          dpt: emptyStage(),
          vote: emptyStage(),
        };
      }
      return perAngkatan[a];
    };

    // Alumni coverage — per-angkatan alumni total for the heatmap "populasi" column
    const alumniPerAngkatan: Record<number, number> = {};
    for (const a of alumniRows) {
      alumniPerAngkatan[a.angkatan] = (alumniPerAngkatan[a.angkatan] || 0) + 1;
      ensureAngkatan(a.angkatan);
    }

    const nextActions = {
      dukungBelumKontak: 0,
      dukungBelumForm: 0,
      formBelumWeb: 0,
      webBelumDpt: 0,
      dptBelumVote: 0,
      belumKontak: 0,
      kontakBelumDukungan: 0,
    };

    let withPhone = 0;
    let withDukungan = 0;
    let suaraAman = 0;       // vote=Sudah & pendukung (dukung/terkonvert)
    let suaraPotensial = 0;  // DPT=Sudah & vote=Belum & pendukung-or-ragu
    let suaraHilang = 0;     // dukungan=sebelah
    let pendukungTotal = 0;  // dukung/terkonvert
    let raguTotal = 0;       // ragu_ragu
    let belumTahuTotal = 0;  // dukungan null

    // Tier counts — DPT registration stage classification (see lib/dptDeadline)
    const emptyTiers = (): Record<DptTier, number> => ({
      aman: 0,
      pending_verifikator: 0,
      perlu_web: 0,
      perlu_gform: 0,
      hilang: 0,
    });
    const tiersPendukung = emptyTiers(); // among dukung members
    const tiersAll = emptyTiers();       // among all members
    const tiersPendukungPerAngkatan: Record<number, Record<DptTier, number>> = {};
    const now = new Date();

    for (const m of memberRows) {
      const d = classifyDukungan(m.dukungan);
      const pa = ensureAngkatan(m.angkatan);
      const contacted = m.sudah_dikontak === "Sudah" || waLinked.has(m.id);
      const form = m.isi_form_dpt === "Sudah";
      const web = m.registrasi_website_dpt === "Sudah";
      const dpt = m.status_dpt === "Sudah";
      const vote = m.vote === "Sudah";
      const pendukung = d === "dukung";

      // Stage 1: terdata — every member counts (with dukungan overlay)
      addToBucket(overall.terdata, d);
      addToBucket(pa.terdata, d);

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

      if (d === "dukung" && !contacted) nextActions.dukungBelumKontak++;
      if (d === "dukung" && !form) nextActions.dukungBelumForm++;
      if (form && !web) nextActions.formBelumWeb++;
      if (web && !dpt) nextActions.webBelumDpt++;
      if (dpt && !vote) nextActions.dptBelumVote++;
      if (!contacted) nextActions.belumKontak++;
      if (contacted && d === "belum") nextActions.kontakBelumDukungan++;

      if (m.no_hp && m.no_hp.trim().length > 0) withPhone++;
      if (m.dukungan) withDukungan++;
      if (pendukung) pendukungTotal++;
      if (d === "ragu") raguTotal++;
      if (d === "belum") belumTahuTotal++;
      if (pendukung && vote) suaraAman++;
      if (dpt && !vote && (pendukung || d === "ragu")) suaraPotensial++;
      if (d === "sebelah") suaraHilang++;

      const tier = classifyTier(m, now);
      tiersAll[tier]++;
      if (pendukung) {
        tiersPendukung[tier]++;
        if (!tiersPendukungPerAngkatan[m.angkatan]) {
          tiersPendukungPerAngkatan[m.angkatan] = emptyTiers();
        }
        tiersPendukungPerAngkatan[m.angkatan][tier]++;
      }
    }

    const overallCounts: Record<StageKey, number> = {
      terdata: overall.terdata.total,
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
    const leakiest = transitions.reduce(
      (worst, t) => (t.drop > worst.drop ? t : worst),
      transitions[0]
    );

    // Per-angkatan "bocor" score: which angkatan leaks the most in absolute drop
    // from terdata→vote (total pipeline loss). Sorted descending — top entries are
    // the angkatan the team should prioritise.
    const perAngkatanArr = Object.entries(perAngkatan)
      .map(([angStr, stages]) => {
        const ang = Number(angStr);
        const alumniTotal = alumniPerAngkatan[ang] || 0;
        const terdataCount = stages.terdata.total;
        const voteCount = stages.vote.total;
        return {
          angkatan: ang,
          alumniTotal,
          terdata: stages.terdata,
          contacted: stages.contacted,
          formDpt: stages.formDpt,
          webDpt: stages.webDpt,
          dpt: stages.dpt,
          vote: stages.vote,
          bocor: terdataCount - voteCount,
          bocorPct: terdataCount > 0 ? ((terdataCount - voteCount) / terdataCount) * 100 : 0,
          coveragePct: alumniTotal > 0 ? (terdataCount / alumniTotal) * 100 : 0,
          tiersPendukung: tiersPendukungPerAngkatan[ang] || emptyTiers(),
        };
      })
      .sort((a, b) => a.angkatan - b.angkatan);

    // Top 3 angkatan by pendukung-belum-DPT — our own supporters not yet on the
    // official voter list. This is more actionable than vote-based leakage because
    // it points the team at supporters we still need to get registered.
    const topBocorAngkatan = [...perAngkatanArr]
      .map((x) => {
        const pendukung = x.terdata.dukung;
        const pendukungDpt = x.dpt.dukung;
        const bocor = Math.max(0, pendukung - pendukungDpt);
        const bocorPct = pendukung > 0 ? (bocor / pendukung) * 100 : 0;
        return { angkatan: x.angkatan, pendukung, pendukungDpt, bocor, bocorPct };
      })
      .filter((x) => x.pendukung > 0)
      .sort((a, b) => b.bocor - a.bocor)
      .slice(0, 3);

    const totalAlumni = alumniRows.length;
    const totalTerdata = memberRows.length;

    const coverage = {
      totalAlumni,
      totalTerdata,
      pct: totalAlumni > 0 ? (totalTerdata / totalAlumni) * 100 : 0,
      withPhone,
      withPhonePct: totalTerdata > 0 ? (withPhone / totalTerdata) * 100 : 0,
      withDukungan,
      withDukunganPct: totalTerdata > 0 ? (withDukungan / totalTerdata) * 100 : 0,
    };

    const pct = (n: number, d: number) => (d > 0 ? (n / d) * 100 : 0);

    const conversion = {
      terdataToContacted: pct(overallCounts.contacted, overallCounts.terdata),
      contactedToForm: pct(overallCounts.formDpt, overallCounts.contacted),
      formToWeb: pct(overallCounts.webDpt, overallCounts.formDpt),
      webToDpt: pct(overallCounts.dpt, overallCounts.webDpt),
      dptToVote: pct(overallCounts.vote, overallCounts.dpt),
      terdataToVote: pct(overallCounts.vote, overallCounts.terdata),
    };

    const dptMetrics = {
      pendukungTotal,
      raguTotal,
      belumTahuTotal,
      sebelahTotal: suaraHilang,
      suaraAman,
      suaraPotensial,
      suaraHilang,
      // "Harus dikejar" = pendukung yg blm vote (operational target for vote day)
      suaraHarusDikejar: pendukungTotal - suaraAman,
    };

    return NextResponse.json({
      overall,
      transitions,
      leakiest,
      perAngkatan: perAngkatanArr,
      nextActions,
      coverage,
      conversion,
      dptMetrics,
      topBocorAngkatan,
      tiers: {
        pendukung: tiersPendukung,
        all: tiersAll,
      },
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
