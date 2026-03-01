import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getUserRole, isSuperAdmin } from "@/lib/roles";
import { normalizePhone } from "@/lib/phone";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/mimin/link — Link Mimin customers to alumni (creating members if needed)
 * Body: { pairs: [{ customer_id, customer_name, customer_phone, alumni_id }] }
 *
 * For each pair:
 * - If alumni already has a member → update phone if empty
 * - If alumni has no member → create member from alumni + set phone from customer
 */
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const role = await getUserRole(supabase);

  if (!isSuperAdmin(role)) {
    return NextResponse.json(
      { error: "Tidak memiliki akses" },
      { status: 403 }
    );
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const pairs: {
    customer_id: string;
    customer_name: string;
    customer_phone: string;
    alumni_id: string;
  }[] = body.pairs || [];

  if (pairs.length === 0) {
    return NextResponse.json(
      { error: "Tidak ada pasangan untuk dihubungkan" },
      { status: 400 }
    );
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let linked = 0;
  let updated = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const pair of pairs) {
    try {
      // Check if alumni exists
      const { data: alumni } = await adminClient
        .from("alumni")
        .select("id, nama, angkatan")
        .eq("id", pair.alumni_id)
        .single();

      if (!alumni) {
        errors.push(`Alumni ${pair.alumni_id} tidak ditemukan`);
        failed++;
        continue;
      }

      // Normalize phone using canonical normalizer
      const phone = normalizePhone(pair.customer_phone || "") || "";

      // Check if alumni already has linked member(s) — use limit(1) to handle multiple
      const { data: existingMembers } = await adminClient
        .from("members")
        .select("id, no_hp, alt_phones")
        .eq("alumni_id", pair.alumni_id)
        .limit(1);

      const existingMember = existingMembers && existingMembers.length > 0 ? existingMembers[0] : null;

      if (existingMember) {
        if (!existingMember.no_hp && phone) {
          // No primary phone — set it
          await adminClient
            .from("members")
            .update({ no_hp: phone })
            .eq("id", existingMember.id);
          updated++;
        } else if (
          phone &&
          existingMember.no_hp &&
          normalizePhone(existingMember.no_hp) !== normalizePhone(phone)
        ) {
          // Primary phone exists and is different — add as alternate if unique
          const existingAlt: string[] = existingMember.alt_phones || [];
          const normalizedNew = normalizePhone(phone);
          const alreadyExists =
            existingAlt.some((p: string) => normalizePhone(p) === normalizedNew);
          if (!alreadyExists && normalizedNew) {
            await adminClient
              .from("members")
              .update({ alt_phones: [...existingAlt, normalizedNew] })
              .eq("id", existingMember.id);
          }
          updated++;
        } else {
          updated++;
        }
      } else {
        // Create new member from alumni
        const { data: maxNoRow } = await adminClient
          .from("members")
          .select("no")
          .order("no", { ascending: false })
          .limit(1)
          .single();

        const nextNo = (maxNoRow?.no || 0) + 1;

        const { error: insertError } = await adminClient
          .from("members")
          .insert({
            no: nextNo,
            nama: alumni.nama,
            angkatan: alumni.angkatan,
            no_hp: phone,
            alumni_id: alumni.id,
            status_dpt: null,
            sudah_dikontak: phone ? "Sudah" : null,
            masuk_grup: null,
            vote: null,
            dukungan: null,
          });

        if (insertError) {
          errors.push(`Gagal membuat member untuk ${alumni.nama}: ${insertError.message}`);
          failed++;
          continue;
        }
        linked++;
      }
    } catch (err) {
      errors.push(err instanceof Error ? err.message : "Unknown error");
      failed++;
    }
  }

  return NextResponse.json({
    linked,
    updated,
    failed,
    errors: errors.length > 0 ? errors : undefined,
  });
}
