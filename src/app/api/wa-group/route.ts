import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getUserRole, canManageUsers } from "@/lib/roles";
import { NextRequest, NextResponse } from "next/server";
import { normalizePhone, wahaPhoneToNormalized } from "@/lib/phone";

// GET — list all wa_group_members with linked member data
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const role = await getUserRole(supabase);

  if (!canManageUsers(role)) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("wa_group_members")
    .select("*, member:members(id, nama, no_hp, angkatan)")
    .order("wa_name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data || [] });
}

// POST — sync participants from WAHA API
export async function POST() {
  const supabase = await createSupabaseServerClient();
  const role = await getUserRole(supabase);

  if (!canManageUsers(role)) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  // 1. Load WAHA config
  const { data: settingsData } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "waha_config")
    .single();

  if (!settingsData?.value) {
    return NextResponse.json(
      { error: "Konfigurasi WAHA belum diatur. Silakan atur di Pengaturan." },
      { status: 400 }
    );
  }

  const config = typeof settingsData.value === "string"
    ? JSON.parse(settingsData.value)
    : settingsData.value;

  const { baseUrl, session, groupId } = config;

  if (!baseUrl || !session || !groupId) {
    return NextResponse.json(
      { error: "Konfigurasi WAHA tidak lengkap (baseUrl, session, groupId diperlukan)" },
      { status: 400 }
    );
  }

  // 2. Fetch participants from WAHA
  let participants: { id: string; pushName?: string; name?: string }[];
  try {
    const wahaUrl = `${baseUrl.replace(/\/$/, "")}/api/${encodeURIComponent(session)}/groups/${encodeURIComponent(groupId)}/participants`;
    const res = await fetch(wahaUrl);

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json(
        { error: `WAHA API error (${res.status}): ${errText}` },
        { status: 502 }
      );
    }

    participants = await res.json();
  } catch (err) {
    return NextResponse.json(
      { error: `Gagal menghubungi WAHA: ${err instanceof Error ? err.message : "Unknown error"}` },
      { status: 502 }
    );
  }

  if (!Array.isArray(participants)) {
    return NextResponse.json(
      { error: "Format respon WAHA tidak valid (expected array)" },
      { status: 502 }
    );
  }

  // 3. Upsert participants into wa_group_members
  const now = new Date().toISOString();
  const rows = participants.map((p) => ({
    phone: wahaPhoneToNormalized(p.id),
    wa_name: p.pushName || p.name || null,
    synced_at: now,
  }));

  let synced = 0;
  for (const row of rows) {
    if (!row.phone) continue;
    const { error: upsertError } = await supabase
      .from("wa_group_members")
      .upsert(
        { phone: row.phone, wa_name: row.wa_name, synced_at: row.synced_at },
        { onConflict: "phone" }
      );
    if (!upsertError) synced++;
  }

  // 4. Auto-link: match unlinked wa_group_members against members.no_hp
  const { data: unlinked } = await supabase
    .from("wa_group_members")
    .select("id, phone")
    .is("member_id", null);

  const { data: allMembers } = await supabase
    .from("members")
    .select("id, no_hp");

  let autoLinked = 0;
  if (unlinked && allMembers) {
    // Build normalized phone → member_id map
    const memberPhoneMap = new Map<string, string>();
    for (const m of allMembers) {
      if (m.no_hp) {
        const normalized = normalizePhone(m.no_hp);
        if (normalized) {
          memberPhoneMap.set(normalized, m.id);
        }
      }
    }

    for (const wm of unlinked) {
      const memberId = memberPhoneMap.get(wm.phone);
      if (memberId) {
        const { error: linkError } = await supabase
          .from("wa_group_members")
          .update({ member_id: memberId })
          .eq("id", wm.id);
        if (!linkError) autoLinked++;
      }
    }
  }

  return NextResponse.json({
    synced,
    autoLinked,
    total: participants.length,
  });
}

// PATCH — link/unlink a wa_group_member to a member
export async function PATCH(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const role = await getUserRole(supabase);

  if (!canManageUsers(role)) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const { waGroupMemberId, memberId } = await request.json();

  if (!waGroupMemberId) {
    return NextResponse.json({ error: "waGroupMemberId diperlukan" }, { status: 400 });
  }

  // Update the wa_group_member record
  const { error } = await supabase
    .from("wa_group_members")
    .update({ member_id: memberId || null })
    .eq("id", waGroupMemberId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
