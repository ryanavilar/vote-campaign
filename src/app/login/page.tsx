"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Eye, EyeOff, LogIn, Loader2 } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError("Email atau password salah. Silakan coba lagi.");
      setLoading(false);
    } else {
      router.push("/");
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Background gradient matching ikastarakita.com */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#fcb7c3] via-[#FE8DA1] to-[#0B27BC]" />
      <div className="absolute inset-0 bg-[url('/images/logo-light.png')] bg-center bg-no-repeat opacity-5 bg-[length:400px]" />

      <div className="relative z-10 w-full max-w-md mx-4">
        {/* Card */}
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-white/20">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <Image
              src="/images/logo-dark.png"
              alt="IKASTARA KITA"
              width={80}
              height={80}
              className="mb-4"
            />
            <h1 className="text-2xl font-bold text-[#0B27BC]">
              Dashboard Pemenangan
            </h1>
            <p className="text-sm text-[#84303F] mt-1">
              Ikastara Kita &mdash; Aditya Syarief
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-[#0B27BC]/60 font-medium">
                Asah &bull; Asih &bull; Asuh
              </span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-semibold text-[#050C35] mb-1.5"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@email.com"
                required
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC] transition-all bg-gray-50/50"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-semibold text-[#050C35] mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password"
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
                <LogIn className="w-4 h-4" />
              )}
              {loading ? "Masuk..." : "Masuk"}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-6">
            Hanya untuk tim pemenangan yang terdaftar
          </p>
        </div>

        {/* Footer branding */}
        <p className="text-center text-xs text-white/60 mt-6">
          &copy; 2026 IKASTARA KITA. Built with Integrity.
        </p>
      </div>
    </div>
  );
}
