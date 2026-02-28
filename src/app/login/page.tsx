"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Eye,
  EyeOff,
  LogIn,
  Loader2,
  ArrowLeft,
  Mail,
  ShieldCheck,
} from "lucide-react";

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  return local[0] + "***@" + domain;
}

export default function LoginPage() {
  const [step, setStep] = useState<"password" | "otp">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const router = useRouter();

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Auto-focus first OTP input when entering OTP step
  useEffect(() => {
    if (step === "otp") {
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    }
  }, [step]);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login gagal");
        setLoading(false);
        return;
      }

      // Password verified, OTP sent — move to step 2
      setStep("otp");
      setResendCooldown(60);
      setError("");
    } catch {
      setError("Terjadi kesalahan. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  const submitOtp = useCallback(
    async (digits: string[]) => {
      const token = digits.join("");
      if (token.length !== 6) return;

      setLoading(true);
      setError("");

      try {
        const res = await fetch("/api/auth/verify-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, token }),
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Verifikasi gagal");
          setOtpDigits(["", "", "", "", "", ""]);
          setTimeout(() => otpRefs.current[0]?.focus(), 100);
          setLoading(false);
          return;
        }

        // Session created — redirect
        window.location.href = "/";
      } catch {
        setError("Terjadi kesalahan. Silakan coba lagi.");
        setLoading(false);
      }
    },
    [email]
  );

  const handleOtpChange = (index: number, value: string) => {
    // Only accept digits
    const digit = value.replace(/\D/g, "").slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = digit;
    setOtpDigits(newDigits);

    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits filled
    if (digit && newDigits.every((d) => d !== "")) {
      submitOtp(newDigits);
    }
  };

  const handleOtpKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;

    const newDigits = [...otpDigits];
    for (let i = 0; i < 6; i++) {
      newDigits[i] = pasted[i] || "";
    }
    setOtpDigits(newDigits);

    // Focus last filled input or submit
    const lastIndex = Math.min(pasted.length, 6) - 1;
    otpRefs.current[lastIndex]?.focus();

    if (newDigits.every((d) => d !== "")) {
      submitOtp(newDigits);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;

    try {
      const res = await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        setResendCooldown(60);
        setError("");
      } else {
        const data = await res.json();
        setError(data.error || "Gagal mengirim ulang kode OTP");
      }
    } catch {
      setError("Gagal mengirim ulang kode OTP");
    }
  };

  const handleBack = () => {
    setStep("password");
    setOtpDigits(["", "", "", "", "", ""]);
    setError("");
    setResendCooldown(0);
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
              width={200}
              height={68}
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

          {/* Step 1: Password */}
          {step === "password" && (
            <form onSubmit={handlePasswordSubmit} className="space-y-5">
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
                {loading ? "Memverifikasi..." : "Masuk"}
              </button>
            </form>
          )}

          {/* Step 2: OTP */}
          {step === "otp" && (
            <div className="space-y-5">
              {/* Header */}
              <div className="text-center space-y-2">
                <div className="mx-auto w-14 h-14 rounded-full bg-[#0B27BC]/10 flex items-center justify-center">
                  <ShieldCheck className="w-7 h-7 text-[#0B27BC]" />
                </div>
                <h2 className="text-lg font-bold text-[#050C35]">
                  Verifikasi OTP
                </h2>
                <p className="text-sm text-gray-500">
                  Kode verifikasi telah dikirim ke{" "}
                  <span className="font-medium text-[#0B27BC]">
                    {maskEmail(email)}
                  </span>
                </p>
              </div>

              {/* OTP inputs */}
              <div className="flex justify-center gap-2">
                {otpDigits.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      otpRefs.current[i] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    onPaste={i === 0 ? handleOtpPaste : undefined}
                    disabled={loading}
                    className="w-12 h-14 text-center text-xl font-bold border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/30 focus:border-[#0B27BC] transition-all bg-gray-50/50 disabled:opacity-50"
                  />
                ))}
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl border border-red-100 text-center">
                  {error}
                </div>
              )}

              {loading && (
                <div className="flex items-center justify-center gap-2 text-sm text-[#0B27BC]">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Memverifikasi...
                </div>
              )}

              {/* Resend */}
              <div className="text-center">
                {resendCooldown > 0 ? (
                  <p className="text-sm text-gray-400">
                    Kirim ulang kode dalam{" "}
                    <span className="font-semibold text-[#0B27BC]">
                      {resendCooldown}s
                    </span>
                  </p>
                ) : (
                  <button
                    onClick={handleResend}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0B27BC] hover:text-[#091fa0] transition-colors"
                  >
                    <Mail className="w-4 h-4" />
                    Kirim ulang kode
                  </button>
                )}
              </div>

              {/* Back button */}
              <button
                onClick={handleBack}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors py-2 disabled:opacity-50"
              >
                <ArrowLeft className="w-4 h-4" />
                Kembali ke login
              </button>
            </div>
          )}

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
