import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      type,
      nama,
      angkatan,
      no_hp,
      email,
      domisili,
      harapan,
      referral_name,
      checkin_code,
      will_attend,
    } = body;

    // Validate required fields
    if (!nama || !angkatan) {
      return NextResponse.json(
        { error: "Nama dan angkatan wajib diisi" },
        { status: 400 }
      );
    }

    if (!type || !["dukungan", "event"].includes(type)) {
      return NextResponse.json(
        { error: "Tipe registrasi tidak valid" },
        { status: 400 }
      );
    }

    // For event registration, validate the event
    let eventData = null;
    if (type === "event") {
      if (!checkin_code) {
        return NextResponse.json(
          { error: "Kode kegiatan diperlukan" },
          { status: 400 }
        );
      }

      const { data: event, error: eventError } = await supabaseAdmin
        .from("events")
        .select("id, nama, status")
        .eq("checkin_code", checkin_code.toUpperCase())
        .single();

      if (eventError || !event) {
        return NextResponse.json(
          { error: "Kegiatan tidak ditemukan" },
          { status: 404 }
        );
      }

      if (event.status === "Dibatalkan" || event.status === "Selesai") {
        return NextResponse.json(
          { error: "Kegiatan ini sudah tidak menerima pendaftaran" },
          { status: 400 }
        );
      }

      eventData = event;
    }

    // Check for existing member (same nama + angkatan)
    const { data: existingMembers } = await supabaseAdmin
      .from("members")
      .select("id, nama, angkatan")
      .ilike("nama", nama.trim())
      .eq("angkatan", Number(angkatan));

    let memberId: string;

    if (existingMembers && existingMembers.length > 0) {
      // Update existing member's info
      memberId = existingMembers[0].id;
      const updateFields: Record<string, string | null> = {};
      if (no_hp) updateFields.no_hp = no_hp;
      if (email) updateFields.email = email;
      if (domisili) updateFields.domisili = domisili;
      if (harapan) updateFields.harapan = harapan;

      if (Object.keys(updateFields).length > 0) {
        await supabaseAdmin
          .from("members")
          .update(updateFields)
          .eq("id", memberId);
      }
    } else {
      // Get next sequential number
      const { data: maxNo } = await supabaseAdmin
        .from("members")
        .select("no")
        .order("no", { ascending: false })
        .limit(1);

      const nextNo = maxNo && maxNo.length > 0 ? maxNo[0].no + 1 : 1;

      // Create new member
      const { data: newMember, error: memberError } = await supabaseAdmin
        .from("members")
        .insert({
          no: nextNo,
          nama: nama.trim(),
          angkatan: Number(angkatan),
          no_hp: no_hp || "",
          email: email || null,
          domisili: domisili || null,
          harapan: harapan || null,
        })
        .select("id")
        .single();

      if (memberError || !newMember) {
        return NextResponse.json(
          { error: "Gagal mendaftarkan anggota: " + (memberError?.message || "Unknown error") },
          { status: 500 }
        );
      }

      memberId = newMember.id;
    }

    // Handle referral — always store the free text, and also try to match by name
    if (referral_name && referral_name.trim()) {
      const trimmed = referral_name.trim();
      const updateFields: Record<string, string> = { referral_name: trimmed };

      const { data: referrer } = await supabaseAdmin
        .from("members")
        .select("id")
        .ilike("nama", trimmed)
        .limit(1);

      if (referrer && referrer.length > 0) {
        updateFields.referred_by = referrer[0].id;
      }

      await supabaseAdmin
        .from("members")
        .update(updateFields)
        .eq("id", memberId);
    }

    // For event registration, store RSVP (not actual attendance/check-in)
    if (type === "event" && eventData) {
      const { error: regError } = await supabaseAdmin
        .from("event_registrations")
        .upsert(
          {
            event_id: eventData.id,
            member_id: memberId,
            will_attend: !!will_attend,
          },
          { onConflict: "event_id,member_id" }
        );

      if (regError) {
        // Non-fatal — member was still created
        console.error("Registration error:", regError.message);
      }
    }

    return NextResponse.json({
      success: true,
      message:
        type === "dukungan"
          ? "Terima kasih atas dukungan Anda!"
          : will_attend
          ? "Pendaftaran berhasil! Sampai jumpa di acara."
          : "Terima kasih telah mengisi formulir.",
      member_name: nama.trim(),
      event_name: eventData?.nama || null,
    });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 }
    );
  }
}
