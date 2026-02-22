"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

export default function AuthCallbackPage() {
  const [error, setError] = useState("");

  useEffect(() => {
    async function handleCallback() {
      try {
        // 1. Check for hash fragment tokens (Supabase invite/magic link flow)
        const hash = window.location.hash;
        if (hash) {
          const params = new URLSearchParams(hash.substring(1));
          const accessToken = params.get("access_token");
          const refreshToken = params.get("refresh_token");
          const type = params.get("type");

          if (accessToken && refreshToken) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (sessionError) {
              setError(sessionError.message);
              return;
            }

            // Invited users need to set password
            if (type === "invite" || type === "recovery") {
              window.location.href = "/onboarding";
              return;
            }

            // Normal sign-in via magic link
            window.location.href = "/";
            return;
          }
        }

        // 2. Check for PKCE code exchange (OAuth flow)
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const type = url.searchParams.get("type");

        if (code) {
          const { error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code);

          if (exchangeError) {
            setError(exchangeError.message);
            return;
          }

          if (type === "invite" || type === "recovery") {
            window.location.href = "/onboarding";
            return;
          }

          window.location.href = url.searchParams.get("next") || "/";
          return;
        }

        // 3. No tokens found — check if already authenticated
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          window.location.href = "/";
        } else {
          window.location.href = "/login";
        }
      } catch {
        setError("Terjadi kesalahan saat memproses autentikasi.");
      }
    }

    handleCallback();
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#fcb7c3] via-[#FE8DA1] to-[#0B27BC]" />
        <div className="relative z-10 w-full max-w-md mx-4">
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-white/20 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
              <span className="text-2xl">!</span>
            </div>
            <h2 className="text-xl font-bold text-red-600">
              Gagal Memproses Link
            </h2>
            <p className="text-sm text-gray-600">{error}</p>
            <a
              href="/login"
              className="inline-block px-6 py-2.5 bg-[#0B27BC] text-white text-sm font-medium rounded-xl hover:bg-[#091fa0] transition-colors"
            >
              Kembali ke Login
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[#fcb7c3] via-[#FE8DA1] to-[#0B27BC]" />
      <div className="relative z-10 flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
        <p className="text-sm text-white/80">Memproses autentikasi...</p>
      </div>
    </div>
  );
}
