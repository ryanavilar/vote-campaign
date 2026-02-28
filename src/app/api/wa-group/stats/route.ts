import { createSupabaseServerClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import { getAllMemberPhones } from "@/lib/phone";

// GET — returns WA group membership stats and member phone set
export async function GET() {
  const supabase = await createSupabaseServerClient();

  // Fetch all wa_group_members
  const { data: waMembers, error: waError } = await supabase
    .from("wa_group_members")
    .select("phone, member_id");

  if (waError) {
    return NextResponse.json({ error: waError.message }, { status: 500 });
  }

  const waData = waMembers || [];
  const totalInGroup = waData.length;
  const linked = waData.filter((w) => w.member_id).length;
  const unlinked = totalInGroup - linked;

  // Build a set of all phones in the WA group for client-side matching
  const phones = waData.map((w) => w.phone);

  // Also fetch all members to build a member_id → inGroup map
  // Check both no_hp AND alt_phones so alternate numbers are recognized
  const { data: members } = await supabase
    .from("members")
    .select("id, no_hp, alt_phones");

  const memberInGroup: Record<string, boolean> = {};
  if (members) {
    const phoneSet = new Set(phones);
    for (const m of members) {
      const allPhones = getAllMemberPhones(m);
      if (allPhones.some((p) => phoneSet.has(p))) {
        memberInGroup[m.id] = true;
      }
    }
  }

  return NextResponse.json({
    totalInGroup,
    linked,
    unlinked,
    phones,
    memberInGroup,
  });
}
