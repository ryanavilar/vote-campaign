"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";

export default function OnboardingPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password minimal 6 karakter.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Password dan konfirmasi tidak cocok.");
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setSuccess(true);
      // Redirect to dashboard after short delay
      setTimeout(() => {
        window.location.href = "/";
      }, 2000);
    } catch {
      setError("Terjadi kesalahan. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#fcb7c3] via-[#FE8DA1] to-[#0B27BC]" />
        <div className="relative z-10 w-full max-w-md mx-4">
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-white/20 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center">
              <ShieldCheck className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-[#0B27BC]">
              Password Berhasil Dibuat!
            </h2>
            <p className="text-sm text-gray-600">
              Mengalihkan ke dashboard...
            </p>
            <Loader2 className="w-5 h-5 animate-spin text-[#0B27BC] mx-auto" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#fcb7c3] via-[#FE8DA1] to-[#0B27BC]" />
      <div className="absolute inset-0 bg-[url('/images/logo-light.png')] bg-center bg-no-repeat opacity-5 bg-[length:400px]" />

      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-white/20">
          {/* Logo */}
          <div className="flex flex-col items-center mb-6">
            <Image
              src="/images/logo-dark.png"
              alt="IKASTARA KITA"
              width={200}
              height={68}
              className="mb-4"
            />
            <h1 className="text-2xl font-bold text-[#0B27BC]">
              Selamat Datang!
            </h1>
            <p className="text-sm text-[#84303F] mt-1 text-center">
              Buat password untuk akun Anda di Dashboard Pemenangan
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-semibold text-[#050C35] mb-1.5"
              >
                Password Baru
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  required
                  className="w-full px-4 py-3 pr-11 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC] transition-all bg-gray-50/50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-semibold text-[#050C35] mb-1.5"
              >
                Konfirmasi Password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ketik ulang password"
                  required
                  className="w-full px-4 py-3 pr-11 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC] transition-all bg-gray-50/50"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl border border-red-100">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-[#0B27BC] text-white py-3 rounded-xl font-semibold text-sm hover:bg-[#091fa0] transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-[#0B27BC]/20"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ShieldCheck className="w-4 h-4" />
              )}
              {loading ? "Menyimpan..." : "Buat Password"}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-6">
            Ikastara Kita &mdash; Dashboard Pemenangan
          </p>
        </div>

        <p className="text-center text-xs text-white/60 mt-6">
          &copy; 2026 IKASTARA KITA. Built with Integrity.
        </p>
      </div>
    </div>
  );
}
