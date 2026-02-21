import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getUserRole, canManageUsers } from "@/lib/roles";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

/**
 * Normalize a name for comparison:
 * - lowercase, trim, collapse whitespace
 * - remove common titles/prefixes
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^(dr\.?|ir\.?|h\.?|hj\.?|prof\.?|drs\.?|m\.?)\s+/i, "")
    .replace(/\s+(s\.?h\.?|s\.?e\.?|m\.?m\.?|m\.?b\.?a\.?)$/i, "");
}

/**
 * Calculate similarity between two strings using bigram overlap (Dice coefficient).
 * Returns a score between 0 and 1.
 */
function bigramSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const bigramsA = new Set<string>();
  for (let i = 0; i < a.length - 1; i++) {
    bigramsA.add(a.substring(i, i + 2));
  }

  const bigramsB = new Set<string>();
  for (let i = 0; i < b.length - 1; i++) {
    bigramsB.add(b.substring(i, i + 2));
  }

  let intersection = 0;
  for (const bg of bigramsA) {
    if (bigramsB.has(bg)) intersection++;
  }

  return (2 * intersection) / (bigramsA.size + bigramsB.size);
}

/**
 * Check if one name could be an abbreviation of the other.
 * E.g., "M. Arief" matches "Muhammad Arief"
 */
function abbreviationMatch(memberName: string, alumniName: string): boolean {
  const mParts = memberName.split(" ");
  const aParts = alumniName.split(" ");

  // Check if abbreviated parts match initials
  let mIdx = 0;
  let aIdx = 0;
  let matchCount = 0;

  while (mIdx < mParts.length && aIdx < aParts.length) {
    const mp = mParts[mIdx];
    const ap = aParts[aIdx];

    if (mp === ap) {
      // Exact word match
      matchCount++;
      mIdx++;
      aIdx++;
    } else if (
      mp.length <= 2 &&
      ap.startsWith(mp.replace(".", ""))
    ) {
      // Abbreviation match: "M." matches "Muhammad"
      matchCount++;
      mIdx++;
      aIdx++;
    } else if (
      ap.length <= 2 &&
      mp.startsWith(ap.replace(".", ""))
    ) {
      // Reverse abbreviation
      matchCount++;
      mIdx++;
      aIdx++;
    } else {
      aIdx++;
    }
  }

  // At least 2 parts matched and covers most of the shorter name
  const minParts = Math.min(mParts.length, aParts.length);
  return matchCount >= 2 && matchCount >= minParts - 1;
}

interface MatchCandidate {
  member_id: string;
  member_nama: string;
  member_angkatan: number;
  alumni_id: string;
  alumni_nama: string;
  alumni_angkatan: number;
  confidence: "certain" | "uncertain";
  similarity: number;
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const role = await getUserRole(supabase);

  if (!canManageUsers(role)) {
    return NextResponse.json(
      { error: "Tidak memiliki akses" },
      { status: 403 }
    );
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get unlinked members
  const { data: unlinkedMembers, error: membersError } = await adminClient
    .from("members")
    .select("id, nama, angkatan")
    .is("alumni_id", null);

  if (membersError) {
    return NextResponse.json(
      { error: membersError.message },
      { status: 500 }
    );
  }

  if (!unlinkedMembers || unlinkedMembers.length === 0) {
    return NextResponse.json({ candidates: [], total_unlinked: 0 });
  }

  // Get all alumni grouped by angkatan for efficient lookup
  const angkatanSet = new Set(unlinkedMembers.map((m) => m.angkatan));
  const { data: alumniData, error: alumniError } = await adminClient
    .from("alumni")
    .select("id, nama, angkatan")
    .in("angkatan", Array.from(angkatanSet));

  if (alumniError) {
    return NextResponse.json(
      { error: alumniError.message },
      { status: 500 }
    );
  }

  // Get already-linked alumni IDs to exclude them
  const { data: linkedAlumni } = await adminClient
    .from("members")
    .select("alumni_id")
    .not("alumni_id", "is", null);

  const linkedAlumniIds = new Set(
    (linkedAlumni || []).map((m) => m.alumni_id)
  );

  // Group alumni by angkatan for fast lookup
  const alumniByAngkatan = new Map<
    number,
    { id: string; nama: string; angkatan: number }[]
  >();
  for (const a of alumniData || []) {
    // Skip already-linked alumni
    if (linkedAlumniIds.has(a.id)) continue;
    const list = alumniByAngkatan.get(a.angkatan) || [];
    list.push(a);
    alumniByAngkatan.set(a.angkatan, list);
  }

  const candidates: MatchCandidate[] = [];

  for (const member of unlinkedMembers) {
    const sameAngkatan = alumniByAngkatan.get(member.angkatan) || [];
    const normalizedMember = normalizeName(member.nama);

    let bestMatch: {
      alumni: (typeof sameAngkatan)[0];
      score: number;
      isExact: boolean;
      isAbbrev: boolean;
    } | null = null;

    for (const alumni of sameAngkatan) {
      const normalizedAlumni = normalizeName(alumni.nama);

      // Exact match (case-insensitive, trimmed)
      if (normalizedMember === normalizedAlumni) {
        bestMatch = { alumni, score: 1.0, isExact: true, isAbbrev: false };
        break;
      }

      // Abbreviation check
      const isAbbrev = abbreviationMatch(normalizedMember, normalizedAlumni);

      // Bigram similarity
      const score = bigramSimilarity(normalizedMember, normalizedAlumni);

      if (
        score >= 0.5 &&
        (!bestMatch || score > bestMatch.score)
      ) {
        bestMatch = { alumni, score, isExact: false, isAbbrev };
      } else if (isAbbrev && (!bestMatch || bestMatch.score < 0.8)) {
        bestMatch = {
          alumni,
          score: Math.max(score, 0.75),
          isExact: false,
          isAbbrev: true,
        };
      }
    }

    if (bestMatch) {
      // Certain: exact match or very high similarity (≥0.85)
      // Uncertain: moderate similarity (0.5-0.85)
      const confidence: "certain" | "uncertain" =
        bestMatch.isExact || bestMatch.score >= 0.85
          ? "certain"
          : "uncertain";

      candidates.push({
        member_id: member.id,
        member_nama: member.nama,
        member_angkatan: member.angkatan,
        alumni_id: bestMatch.alumni.id,
        alumni_nama: bestMatch.alumni.nama,
        alumni_angkatan: bestMatch.alumni.angkatan,
        confidence,
        similarity: Math.round(bestMatch.score * 100),
      });
    }
  }

  // Sort: certain first, then by similarity descending
  candidates.sort((a, b) => {
    if (a.confidence !== b.confidence) {
      return a.confidence === "certain" ? -1 : 1;
    }
    return b.similarity - a.similarity;
  });

  return NextResponse.json({
    candidates,
    total_unlinked: unlinkedMembers.length,
    total_certain: candidates.filter((c) => c.confidence === "certain").length,
    total_uncertain: candidates.filter((c) => c.confidence === "uncertain")
      .length,
    total_no_match:
      unlinkedMembers.length - candidates.length,
  });
}
