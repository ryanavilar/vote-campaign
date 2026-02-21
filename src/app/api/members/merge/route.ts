import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getUserRole, canEdit } from "@/lib/roles";
import { NextRequest, NextResponse } from "next/server";

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

/**
 * POST /api/members/merge
 * Merges two duplicate members into one.
 *
 * Body: {
 *   winner_id: string,    // The member that survives
 *   loser_id: string,     // The member that gets deleted
 *   fields: Record<string, "winner" | "loser">  // Which value to keep per field
 * }
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

  const body = await request.json();
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
    "referral_name", "alumni_id",
  ];

  const updates: Record<string, unknown> = {};
  for (const field of mergeableFields) {
    if (fields[field] === "loser") {
      // Take the loser's value
      updates[field] = loser[field];
    }
    // If "winner" or not specified, keep winner's value (no update needed)
  }

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

  // 2. Transfer campaigner_targets from loser to winner (avoid duplicates)
  const { data: loserTargets } = await adminClient
    .from("campaigner_targets")
    .select("user_id")
    .eq("member_id", loser_id);

  if (loserTargets && loserTargets.length > 0) {
    // Get existing winner targets to avoid duplicates
    const { data: winnerTargets } = await adminClient
      .from("campaigner_targets")
      .select("user_id")
      .eq("member_id", winner_id);

    const existingUsers = new Set(
      (winnerTargets || []).map((t) => t.user_id)
    );

    const newTargets = loserTargets
      .filter((t) => !existingUsers.has(t.user_id))
      .map((t) => ({ user_id: t.user_id, member_id: winner_id }));

    if (newTargets.length > 0) {
      await adminClient.from("campaigner_targets").insert(newTargets);
    }
  }

  // 3. Transfer event_attendance from loser to winner
  await adminClient
    .from("event_attendance")
    .update({ member_id: winner_id })
    .eq("member_id", loser_id);

  // 4. Transfer event_registrations from loser to winner
  await adminClient
    .from("event_registrations")
    .update({ member_id: winner_id })
    .eq("member_id", loser_id);

  // 5. Update referred_by references pointing to loser
  await adminClient
    .from("members")
    .update({ referred_by: winner_id })
    .eq("referred_by", loser_id);

  // 6. Delete loser's campaigner_targets
  await adminClient
    .from("campaigner_targets")
    .delete()
    .eq("member_id", loser_id);

  // 7. Delete the loser member
  const { error: deleteError } = await adminClient
    .from("members")
    .delete()
    .eq("id", loser_id);

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
