import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getUserRole, canManageUsers, isSuperAdmin } from "@/lib/roles";
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

// POST — sync participants from WAHA API (super_admin only)
export async function POST() {
  const supabase = await createSupabaseServerClient();
  const role = await getUserRole(supabase);

  if (!isSuperAdmin(role)) {
    return NextResponse.json(
      { error: "Hanya Super Admin yang dapat melakukan sinkronisasi WA Group" },
      { status: 403 }
    );
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

  const { baseUrl, session, apiKey, groupId } = config;

  if (!baseUrl || !session || !groupId) {
    return NextResponse.json(
      { error: "Konfigurasi WAHA tidak lengkap (baseUrl, session, groupId diperlukan)" },
      { status: 400 }
    );
  }

  // 2. Fetch participants from WAHA
  // WAHA GOWS response format:
  // { JID, PhoneNumber: "6285xxx@s.whatsapp.net", LID, IsAdmin, DisplayName, ... }
  interface WahaParticipant {
    JID?: string;
    PhoneNumber?: string;
    LID?: string;
    IsAdmin?: boolean;
    IsSuperAdmin?: boolean;
    DisplayName?: string;
    Error?: number;
    // Legacy NOWEB format fields
    id?: string;
    pushName?: string;
    name?: string;
  }

  let participants: WahaParticipant[];
  try {
    const wahaUrl = `${baseUrl.replace(/\/$/, "")}/api/${encodeURIComponent(session)}/groups/${encodeURIComponent(groupId)}/participants`;
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers["X-Api-Key"] = apiKey;
    }
    const res = await fetch(wahaUrl, { headers });

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
  // Handle both GOWS format (PhoneNumber: "628xxx@s.whatsapp.net") and
  // NOWEB format (id: "628xxx@c.us")
  // Also handle LID format (JID: "xxx@lid") as fallback
  // Normalize through normalizePhone to ensure 0→62 and strip symbols
  const now = new Date().toISOString();
  const rows = participants.map((p) => {
    // Try PhoneNumber first, then id, then JID as fallback
    const rawPhone = p.PhoneNumber || p.id || "";
    let phone = "";
    let isLid = false;

    if (rawPhone) {
      const stripped = wahaPhoneToNormalized(rawPhone);
      phone = normalizePhone(stripped) || stripped;
    } else if (p.JID) {
      // JID fallback — could be "628xxx@s.whatsapp.net" or "xxx@lid"
      if (p.JID.endsWith("@lid")) {
        // LID (Linked ID) — WhatsApp internal ID, not a real phone number
        phone = "LID:" + p.JID.replace(/@lid$/, "");
        isLid = true;
      } else {
        const stripped = wahaPhoneToNormalized(p.JID);
        phone = normalizePhone(stripped) || stripped;
      }
    }

    const displayName = p.DisplayName || p.pushName || p.name || null;
    return { phone, wa_name: displayName, synced_at: now, isLid };
  });

  // Track detailed results
  const added: { phone: string; wa_name: string | null }[] = [];
  const updated: { phone: string; wa_name: string | null }[] = [];
  const failed: { phone: string; wa_name: string | null; reason: string }[] = [];
  const lidEntries: { phone: string; wa_name: string | null }[] = [];

  // Check which phones already exist
  const existingPhones = new Set<string>();
  const { data: existingWaMembers } = await supabase
    .from("wa_group_members")
    .select("phone");
  if (existingWaMembers) {
    for (const m of existingWaMembers) {
      existingPhones.add(m.phone);
    }
  }

  let synced = 0;
  for (const row of rows) {
    if (!row.phone) {
      failed.push({ phone: "(kosong)", wa_name: row.wa_name, reason: "Nomor HP kosong" });
      continue;
    }
    // Track LID entries separately — these are WhatsApp internal IDs, not real phone numbers
    if (row.isLid) {
      lidEntries.push({ phone: row.phone, wa_name: row.wa_name });
    }

    const isNew = !existingPhones.has(row.phone);
    const { error: upsertError } = await supabase
      .from("wa_group_members")
      .upsert(
        { phone: row.phone, wa_name: row.wa_name, synced_at: row.synced_at },
        { onConflict: "phone" }
      );
    if (!upsertError) {
      synced++;
      if (!row.isLid) {
        if (isNew) {
          added.push({ phone: row.phone, wa_name: row.wa_name });
        } else {
          updated.push({ phone: row.phone, wa_name: row.wa_name });
        }
      }
    } else {
      failed.push({ phone: row.phone, wa_name: row.wa_name, reason: upsertError.message });
    }
  }

  // 4. Clean member phone numbers: strip all symbols, normalize 0→62
  const { data: allMembers } = await supabase
    .from("members")
    .select("id, no_hp, nama, angkatan");

  if (allMembers) {
    for (const m of allMembers) {
      if (m.no_hp) {
        const cleaned = normalizePhone(m.no_hp);
        if (cleaned && cleaned !== m.no_hp) {
          await supabase
            .from("members")
            .update({ no_hp: cleaned })
            .eq("id", m.id);
        }
      }
    }
  }

  // 5. Auto-link: match unlinked wa_group_members against members.no_hp
  const { data: unlinked } = await supabase
    .from("wa_group_members")
    .select("id, phone, wa_name")
    .is("member_id", null);

  // Re-fetch members after cleaning
  const { data: cleanedMembers } = await supabase
    .from("members")
    .select("id, no_hp, nama, angkatan");

  const linked: { phone: string; wa_name: string | null; member_nama: string; angkatan: number }[] = [];
  const stillUnlinked: { phone: string; wa_name: string | null }[] = [];

  if (unlinked && cleanedMembers) {
    // Build normalized phone → member map
    const memberPhoneMap = new Map<string, { id: string; nama: string; angkatan: number }>();
    for (const m of cleanedMembers) {
      if (m.no_hp) {
        const normalized = normalizePhone(m.no_hp);
        if (normalized) {
          memberPhoneMap.set(normalized, { id: m.id, nama: m.nama, angkatan: m.angkatan });
        }
      }
    }

    for (const wm of unlinked) {
      // Normalize the WA phone too for matching
      const normalizedWaPhone = normalizePhone(wm.phone) || wm.phone;
      const member = memberPhoneMap.get(normalizedWaPhone);
      if (member) {
        const { error: linkError } = await supabase
          .from("wa_group_members")
          .update({ member_id: member.id })
          .eq("id", wm.id);
        if (!linkError) {
          linked.push({
            phone: wm.phone,
            wa_name: wm.wa_name,
            member_nama: member.nama,
            angkatan: member.angkatan,
          });
        } else {
          failed.push({ phone: wm.phone, wa_name: wm.wa_name, reason: linkError.message });
        }
      } else {
        stillUnlinked.push({ phone: wm.phone, wa_name: wm.wa_name });
      }
    }
  }

  return NextResponse.json({
    synced,
    total: participants.length,
    added,
    updated,
    linked,
    stillUnlinked,
    lidEntries,
    failed,
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
