import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getUserRole, isSuperAdmin } from "@/lib/roles";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const MIMIN_BASE_URL = "https://mimin-api.mimin.io/mimin-backend";

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
 * Normalize a name for comparison:
 * lowercase, trim, collapse whitespace, remove common titles/suffixes
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
 * Calculate similarity using bigram overlap (Dice coefficient).
 */
function bigramSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const bigramsA = new Set<string>();
  for (let i = 0; i < a.length - 1; i++) bigramsA.add(a.substring(i, i + 2));

  const bigramsB = new Set<string>();
  for (let i = 0; i < b.length - 1; i++) bigramsB.add(b.substring(i, i + 2));

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
function abbreviationMatch(nameA: string, nameB: string): boolean {
  const aParts = nameA.split(" ");
  const bParts = nameB.split(" ");

  let aIdx = 0;
  let bIdx = 0;
  let matchCount = 0;

  while (aIdx < aParts.length && bIdx < bParts.length) {
    const ap = aParts[aIdx];
    const bp = bParts[bIdx];

    if (ap === bp) {
      matchCount++;
      aIdx++;
      bIdx++;
    } else if (ap.length <= 2 && bp.startsWith(ap.replace(".", ""))) {
      matchCount++;
      aIdx++;
      bIdx++;
    } else if (bp.length <= 2 && ap.startsWith(bp.replace(".", ""))) {
      matchCount++;
      aIdx++;
      bIdx++;
    } else {
      bIdx++;
    }
  }

  const minParts = Math.min(aParts.length, bParts.length);
  return matchCount >= 2 && matchCount >= minParts - 1;
}

interface MiminCustomer {
  _id: string;
  name: string;
  phone: string;
  created_at: string;
  [key: string]: unknown;
}

interface MatchCandidate {
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  alumni_id: string;
  alumni_nama: string;
  alumni_angkatan: number;
  confidence: "certain" | "uncertain";
  similarity: number;
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const role = await getUserRole(supabase);

  if (!isSuperAdmin(role)) {
    return NextResponse.json(
      { error: "Tidak memiliki akses" },
      { status: 403 }
    );
  }

  // Get Mimin token
  const { data: tokenData } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "mimin_token")
    .single();

  const token = tokenData?.value as string | null;
  if (!token) {
    return NextResponse.json(
      { error: "Token Mimin.io belum dikonfigurasi" },
      { status: 400 }
    );
  }

  // Fetch all Mimin customers
  let allCustomers: MiminCustomer[] = [];
  try {
    let pg = 1;
    let hasMore = true;
    while (hasMore) {
      const url = `${MIMIN_BASE_URL}/api/v1/customer/get?order=_id&sort=1&page=${pg}&limit=500`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Mimin API error ${res.status}`);
      const json = await res.json();
      allCustomers = allCustomers.concat(json.data || []);
      hasMore = pg < (json.pages || 1);
      pg++;
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal mengambil data customer" },
      { status: 500 }
    );
  }

  if (allCustomers.length === 0) {
    return NextResponse.json({ candidates: [], total_customers: 0 });
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch all alumni
  let alumniData: { id: string; nama: string; angkatan: number }[];
  try {
    alumniData = await fetchAll(adminClient, "alumni", "id, nama, angkatan");
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal mengambil data alumni" },
      { status: 500 }
    );
  }

  // Get already-linked members (alumni that already have members with phone data)
  // We want to match Mimin customers to alumni, then those alumni can become members
  let existingMembers: { alumni_id: string; no_hp: string }[];
  try {
    existingMembers = await fetchAll(
      adminClient,
      "members",
      "alumni_id, no_hp",
      (q) => q.not("alumni_id", "is", null)
    );
  } catch {
    existingMembers = [];
  }

  // Build a set of alumni IDs that already have members with matching phone
  const linkedAlumniPhones = new Map<string, string>();
  for (const m of existingMembers) {
    if (m.alumni_id && m.no_hp) {
      linkedAlumniPhones.set(m.alumni_id, m.no_hp);
    }
  }

  const candidates: MatchCandidate[] = [];

  for (const customer of allCustomers) {
    if (!customer.name) continue;
    const normalizedCustomer = normalizeName(customer.name);

    let bestMatch: {
      alumni: (typeof alumniData)[0];
      score: number;
      isExact: boolean;
      isAbbrev: boolean;
    } | null = null;

    for (const alumni of alumniData) {
      const normalizedAlumni = normalizeName(alumni.nama);

      // Exact match
      if (normalizedCustomer === normalizedAlumni) {
        bestMatch = { alumni, score: 1.0, isExact: true, isAbbrev: false };
        break;
      }

      // Abbreviation check
      const isAbbrev = abbreviationMatch(normalizedCustomer, normalizedAlumni);

      // Bigram similarity
      const score = bigramSimilarity(normalizedCustomer, normalizedAlumni);

      if (score >= 0.5 && (!bestMatch || score > bestMatch.score)) {
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
      const confidence: "certain" | "uncertain" =
        bestMatch.isExact || bestMatch.score >= 0.85 ? "certain" : "uncertain";

      candidates.push({
        customer_id: customer._id,
        customer_name: customer.name,
        customer_phone: customer.phone || "",
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
    if (a.confidence !== b.confidence) return a.confidence === "certain" ? -1 : 1;
    return b.similarity - a.similarity;
  });

  return NextResponse.json({
    candidates,
    total_customers: allCustomers.length,
    total_certain: candidates.filter((c) => c.confidence === "certain").length,
    total_uncertain: candidates.filter((c) => c.confidence === "uncertain").length,
    total_no_match: allCustomers.length - candidates.length,
  });
}
