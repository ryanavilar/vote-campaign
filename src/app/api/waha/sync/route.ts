import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getUserRole, canManageUsers } from "@/lib/roles";
import { createClient } from "@supabase/supabase-js";
import { normalizePhone, wahaPhoneToNormalized } from "@/lib/phone";
import { NextRequest, NextResponse } from "next/server";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();

  const role = await getUserRole(supabase);
  if (!canManageUsers(role)) {
    return NextResponse.json(
      { error: "Tidak memiliki akses" },
      { status: 403 }
    );
  }

  try {
    // Read WAHA config from app_settings
    const { data: config } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "waha_config")
      .single();

    if (!config?.value?.baseUrl || !config?.value?.groupId) {
      return NextResponse.json(
        { error: "Konfigurasi WAHA belum lengkap" },
        { status: 400 }
      );
    }

    const { baseUrl, session = "default", apiKey, groupId } = config.value;

    // Fetch group participants from WAHA
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers["X-Api-Key"] = apiKey;
    }

    const response = await fetch(
      `${baseUrl}/api/${session}/groups/${groupId}/participants`,
      { headers }
    );

    const participants = await response.json();

    // Normalize all participant phones into a Set
    const participantPhones = new Set<string>(
      participants.map((p: { id: string }) => wahaPhoneToNormalized(p.id))
    );

    // Fetch all members from database using admin client (bypass RLS)
    const adminClient = getAdminClient();
    const { data: members, error: membersError } = await adminClient
      .from("members")
      .select("id, no_hp, masuk_grup");

    if (membersError) {
      throw new Error(membersError.message);
    }

    // Determine which members need updating
    const updates: { id: string; masuk_grup: string }[] = [];
    let matched = 0;
    let alreadyCorrect = 0;

    for (const member of members || []) {
      if (!member.no_hp) continue;

      const normalized = normalizePhone(member.no_hp);
      if (!normalized) continue;

      const inGroup = participantPhones.has(normalized);
      const shouldBe = inGroup ? "Sudah" : "Belum";

      if (inGroup) matched++;

      if (member.masuk_grup !== shouldBe) {
        updates.push({ id: member.id, masuk_grup: shouldBe });
      } else {
        alreadyCorrect++;
      }
    }

    // Batch update all changed members
    for (const update of updates) {
      await adminClient
        .from("members")
        .update({ masuk_grup: update.masuk_grup })
        .eq("id", update.id);
    }

    return NextResponse.json({
      total_members: members?.length || 0,
      total_participants: participantPhones.size,
      matched,
      updated: updates.length,
      already_correct: alreadyCorrect,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Gagal sinkronisasi: " + message },
      { status: 500 }
    );
  }
}
