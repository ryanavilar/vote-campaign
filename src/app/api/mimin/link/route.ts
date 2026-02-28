import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getUserRole, isSuperAdmin } from "@/lib/roles";
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

      // Normalize phone: ensure starts with 62
      let phone = (pair.customer_phone || "").replace(/[^0-9]/g, "");
      if (phone.startsWith("0")) phone = "62" + phone.substring(1);
      if (!phone.startsWith("62") && phone.length > 0) phone = "62" + phone;

      // Check if alumni already has a linked member
      const { data: existingMember } = await adminClient
        .from("members")
        .select("id, no_hp")
        .eq("alumni_id", pair.alumni_id)
        .maybeSingle();

      if (existingMember) {
        // Member exists — update phone if current is empty
        if (!existingMember.no_hp && phone) {
          await adminClient
            .from("members")
            .update({ no_hp: phone })
            .eq("id", existingMember.id);
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
