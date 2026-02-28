import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { email } = await request.json();

  if (!email) {
    return NextResponse.json(
      { error: "Email wajib diisi" },
      { status: 400 }
    );
  }

  const tempClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { error } = await tempClient.auth.signInWithOtp({ email });

  if (error) {
    return NextResponse.json(
      { error: "Gagal mengirim ulang kode OTP." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
