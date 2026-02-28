import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { email, password } = await request.json();

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email dan password wajib diisi" },
      { status: 400 }
    );
  }

  // Create a temporary client to verify password (not the SSR client — we don't want cookies set)
  const tempClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Step 1: Verify password
  const { error: signInError } =
    await tempClient.auth.signInWithPassword({ email, password });

  if (signInError) {
    // Check if user is banned
    if (signInError.message.includes("banned") || signInError.message.includes("disabled")) {
      return NextResponse.json(
        { error: "Akun Anda telah dinonaktifkan. Hubungi admin." },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: "Email atau password salah." },
      { status: 401 }
    );
  }

  // Immediately sign out — we don't want to persist this session
  await tempClient.auth.signOut();

  // Step 2: Send OTP to email
  const { error: otpError } = await tempClient.auth.signInWithOtp({ email });

  if (otpError) {
    return NextResponse.json(
      { error: "Gagal mengirim kode OTP: " + otpError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
