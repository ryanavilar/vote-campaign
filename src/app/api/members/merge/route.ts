import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getUserRole, isSuperAdmin } from "@/lib/roles";
import { normalizePhone } from "@/lib/phone";
import { NextRequest, NextResponse } from "next/server";

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

/**
 * Merge all phones from multiple members into a single set.
 * Returns { primary, altPhones } — primary is the best no_hp, altPhones are deduplicated extras.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mergePhones(members: any[]): { primary: string | null; altPhones: string[] } {
  const seen = new Set<string>();
  let primary: string | null = null;

  // First member's no_hp is primary (if available)
  for (const m of members) {
    if (m.no_hp && !primary) {
      const n = normalizePhone(m.no_hp);
      if (n) {
        primary = n;
        seen.add(n);
        break;
      }
    }
  }

  // Collect all phones from all members
  for (const m of members) {
    if (m.no_hp) {
      const n = normalizePhone(m.no_hp);
      if (n && !seen.has(n)) seen.add(n);
    }
    if (m.alt_phones) {
      for (const p of m.alt_phones) {
        const n = normalizePhone(p);
        if (n && !seen.has(n)) seen.add(n);
      }
    }
  }

  // Remove primary from set to get alt_phones
  const altPhones = Array.from(seen).filter((p) => p !== primary);
  return { primary, altPhones };
}

/**
 * Pick the best value for a binary status field from multiple members.
 * Priority: "Sudah" > "Belum" > null
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function bestBinary(members: any[], field: string): string | null {
  for (const m of members) {
    if (m[field] === "Sudah") return "Sudah";
  }
  for (const m of members) {
    if (m[field] === "Belum") return "Belum";
  }
  return null;
}

/**
 * Pick the first non-null value for a field from multiple members.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function firstNonNull(members: any[], field: string): unknown {
  for (const m of members) {
    if (m[field] !== null && m[field] !== undefined) return m[field];
  }
  return null;
}

/**
 * Transfer all relations from loser_id to winner_id, then delete loser.
 */
async function transferAndDelete(winner_id: string, loser_id: string) {
  // Transfer campaigner_targets (avoid duplicates)
  const { data: loserTargets } = await adminClient
    .from("campaigner_targets")
    .select("user_id")
    .eq("member_id", loser_id);

  if (loserTargets && loserTargets.length > 0) {
    const { data: winnerTargets } = await adminClient
      .from("campaigner_targets")
      .select("user_id")
      .eq("member_id", winner_id);

    const existingUsers = new Set((winnerTargets || []).map((t) => t.user_id));
    const newTargets = loserTargets
      .filter((t) => !existingUsers.has(t.user_id))
      .map((t) => ({ user_id: t.user_id, member_id: winner_id }));

    if (newTargets.length > 0) {
      await adminClient.from("campaigner_targets").insert(newTargets);
    }
  }

  // Transfer event_attendance
  await adminClient
    .from("event_attendance")
    .update({ member_id: winner_id })
    .eq("member_id", loser_id);

  // Transfer event_registrations
  await adminClient
    .from("event_registrations")
    .update({ member_id: winner_id })
    .eq("member_id", loser_id);

  // Transfer wa_group_members links
  await adminClient
    .from("wa_group_members")
    .update({ member_id: winner_id })
    .eq("member_id", loser_id);

  // Update referred_by references
  await adminClient
    .from("members")
    .update({ referred_by: winner_id })
    .eq("referred_by", loser_id);

  // Delete loser's campaigner_targets
  await adminClient
    .from("campaigner_targets")
    .delete()
    .eq("member_id", loser_id);

  // Delete the loser member
  const { error } = await adminClient
    .from("members")
    .delete()
    .eq("id", loser_id);

  return error;
}

/**
 * POST /api/members/merge
 *
 * Mode 1 — Auto-merge by alumni_id (for alumni page):
 * Body: { alumni_id: string }
 * Merges all members linked to this alumni into one, keeping the best data.
 *
 * Mode 2 — Manual merge (existing):
 * Body: { winner_id, loser_id, fields: Record<string, "winner"|"loser"> }
 */
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const role = await getUserRole(supabase);

  if (!isSuperAdmin(role)) {
    return NextResponse.json(
      { error: "Hanya super admin yang dapat merge member" },
      { status: 403 }
    );
  }

  const body = await request.json();

  // ── Mode 1: Auto-merge by alumni_id ──
  if (body.alumni_id) {
    const { alumni_id } = body;

    // Fetch all members for this alumni
    const { data: members, error: fetchErr } = await adminClient
      .from("members")
      .select("*")
      .eq("alumni_id", alumni_id)
      .order("no", { ascending: true });

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    if (!members || members.length < 2) {
      return NextResponse.json(
        { error: "Alumni ini hanya memiliki 1 member, tidak perlu merge" },
        { status: 400 }
      );
    }

    // Pick first member as winner (lowest `no` = oldest)
    const winner = members[0];
    const losers = members.slice(1);

    // Build merged data
    const { primary, altPhones } = mergePhones(members);
    const mergedData: Record<string, unknown> = {
      no_hp: primary || winner.no_hp,
      alt_phones: altPhones.length > 0 ? altPhones : [],
      sudah_dikontak: bestBinary(members, "sudah_dikontak"),
      masuk_grup: bestBinary(members, "masuk_grup"),
      status_dpt: bestBinary(members, "status_dpt"),
      vote: bestBinary(members, "vote"),
      dukungan: firstNonNull(members, "dukungan"),
      pic: firstNonNull(members, "pic"),
      email: firstNonNull(members, "email"),
      domisili: firstNonNull(members, "domisili"),
      referral_name: firstNonNull(members, "referral_name"),
    };

    // Update winner with merged data
    const { error: updateErr } = await adminClient
      .from("members")
      .update(mergedData)
      .eq("id", winner.id);

    if (updateErr) {
      return NextResponse.json(
        { error: `Gagal update data: ${updateErr.message}` },
        { status: 500 }
      );
    }

    // Transfer relations & delete each loser
    const deleteErrors: string[] = [];
    for (const loser of losers) {
      const err = await transferAndDelete(winner.id, loser.id);
      if (err) deleteErrors.push(`${loser.nama || loser.id}: ${err.message}`);
    }

    // Fetch updated winner
    const { data: mergedMember } = await adminClient
      .from("members")
      .select("*")
      .eq("id", winner.id)
      .single();

    return NextResponse.json({
      success: true,
      member: mergedMember,
      merged_count: losers.length,
      errors: deleteErrors.length > 0 ? deleteErrors : undefined,
    });
  }

  // ── Mode 2: Manual merge (existing behavior) ──
  const { winner_id, loser_id, fields } = body;

  if (!winner_id || !loser_id || !fields) {
    return NextResponse.json(
      { error: "winner_id, loser_id, dan fields diperlukan" },
      { status: 400 }
    );
  }

  if (winner_id === loser_id) {
    return NextResponse.json(
      { error: "Tidak bisa merge member yang sama" },
      { status: 400 }
    );
  }

  // Fetch both members
  const [winnerRes, loserRes] = await Promise.all([
    adminClient.from("members").select("*").eq("id", winner_id).single(),
    adminClient.from("members").select("*").eq("id", loser_id).single(),
  ]);

  if (winnerRes.error || !winnerRes.data) {
    return NextResponse.json(
      { error: "Member pemenang tidak ditemukan" },
      { status: 404 }
    );
  }
  if (loserRes.error || !loserRes.data) {
    return NextResponse.json(
      { error: "Member yang dihapus tidak ditemukan" },
      { status: 404 }
    );
  }

  const winner = winnerRes.data;
  const loser = loserRes.data;

  // Build merged data by picking values based on `fields` map
  const mergeableFields = [
    "nama", "angkatan", "no_hp", "pic", "email", "domisili",
    "status_dpt", "sudah_dikontak", "masuk_grup", "vote",
    "referral_name", "alumni_id", "dukungan",
  ];

  const updates: Record<string, unknown> = {};
  for (const field of mergeableFields) {
    if (fields[field] === "loser") {
      updates[field] = loser[field];
    }
  }

  // Merge phones: collect all unique phones from both members
  const { primary, altPhones } = mergePhones([winner, loser]);
  const finalPrimary = updates.no_hp
    ? normalizePhone(updates.no_hp as string)
    : primary;
  updates.no_hp = finalPrimary;
  updates.alt_phones = altPhones.filter(
    (p) => p !== finalPrimary
  );

  // 1. Update the winner with merged data
  if (Object.keys(updates).length > 0) {
    const { error: updateError } = await adminClient
      .from("members")
      .update(updates)
      .eq("id", winner_id);

    if (updateError) {
      return NextResponse.json(
        { error: `Gagal update data: ${updateError.message}` },
        { status: 500 }
      );
    }
  }

  // Transfer & delete
  const deleteError = await transferAndDelete(winner_id, loser_id);
  if (deleteError) {
    return NextResponse.json(
      { error: `Gagal menghapus member duplikat: ${deleteError.message}` },
      { status: 500 }
    );
  }

  // Fetch the updated winner
  const { data: mergedMember } = await adminClient
    .from("members")
    .select("*")
    .eq("id", winner_id)
    .single();

  return NextResponse.json({
    success: true,
    member: mergedMember,
  });
}
