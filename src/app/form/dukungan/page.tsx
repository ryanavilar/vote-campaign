"use client";

import { useState } from "react";
import { Loader2, CheckCircle, Heart } from "lucide-react";
import Image from "next/image";

const ANGKATAN_OPTIONS = Array.from({ length: 33 }, (_, i) => i + 1);

export default function DukunganFormPage() {
  const [form, setForm] = useState({
    nama: "",
    no_hp: "",
    email: "",
    angkatan: "",
    domisili: "",
    harapan: "",
    referral_name: "",
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.nama.trim() || !form.angkatan || !form.no_hp.trim()) {
      setError("Nama, angkatan, dan nomor WhatsApp wajib diisi.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/public/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "dukungan",
          nama: form.nama.trim(),
          angkatan: Number(form.angkatan),
          no_hp: form.no_hp.trim(),
          email: form.email.trim() || null,
          domisili: form.domisili.trim() || null,
          harapan: form.harapan.trim() || null,
          referral_name: form.referral_name.trim() || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Terjadi kesalahan. Silakan coba lagi.");
        return;
      }

      setSuccess(true);
    } catch {
      setError("Gagal mengirim formulir. Periksa koneksi internet Anda.");
    } finally {
      setLoading(false);
    }
  };

  /* ─── Success Screen ─── */
  if (success) {
    return (
      <div className="min-h-screen bg-[#fcb7c3] flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md text-center space-y-5">
          <div className="bg-white rounded-2xl p-8 shadow-[0_10px_40px_-10px_rgba(11,39,188,0.12)] space-y-5">
            <div className="mx-auto w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-[#0B27BC]">
              Terima kasih atas dukunganmu!
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              Dukunganmu sangat berarti untuk kemajuan Ikastara. Bersama kita
              wujudkan Ikastara yang lebih baik.
            </p>
            <div className="pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-3">
                Bergabung di grup WhatsApp untuk info terbaru:
              </p>
              <a
                href="https://chat.whatsapp.com/placeholder"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#25D366] text-white text-sm font-medium rounded-xl hover:bg-[#1fb855] transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                Gabung Grup WhatsApp
              </a>
            </div>
          </div>
          <div className="flex items-center justify-center gap-3">
            <a
              href="https://instagram.com/ikastarakita"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#84303F]/60 hover:text-[#84303F] transition-colors"
            >
              @ikastarakita
            </a>
            <span className="text-[#84303F]/30">·</span>
            <a
              href="https://ikastarakita.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#84303F]/60 hover:text-[#84303F] transition-colors"
            >
              ikastarakita.com
            </a>
          </div>
        </div>
      </div>
    );
  }

  /* ─── Main Form ─── */
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero — Pink background, candidate on right */}
      <div className="bg-[#fcb7c3] relative overflow-hidden">
        {/* Decorative glow */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-[#FE8DA1]/40 rounded-full blur-3xl -translate-y-1/3 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#0B27BC]/10 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4" />

        <div className="max-w-lg mx-auto px-5 pt-6 pb-0 relative">
          {/* Logo */}
          <Image
            src="https://ikastarakita.com/wp-content/uploads/2026/02/logo-ikastara-small.png"
            alt="Ikastara Kita"
            width={120}
            height={40}
            className="mb-2"
            unoptimized
          />

          {/* Content row: text left, candidate right */}
          <div className="flex items-end gap-3">
            {/* Left — Text */}
            <div className="flex-1 pb-6">
              <p className="text-[10px] uppercase tracking-widest text-[#84303F] font-bold mb-1">
                Caketum IKASTARA — MUNAS 11
              </p>
              <h1 className="text-xl sm:text-2xl font-bold text-[#0B27BC] leading-tight mb-2">
                Aditya Syarief Darmasetiawan
              </h1>
              <p className="text-xs text-[#84303F]/70 leading-relaxed mb-3">
                Alumni SMA Taruna Nusantara, Angkatan 13
              </p>

              {/* Values pills */}
              <div className="flex flex-wrap gap-1.5">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white/60 backdrop-blur-sm rounded-full text-[10px] font-semibold text-[#0B27BC]">
                  <Image
                    src="https://ikastarakita.com/wp-content/uploads/2026/02/asah.png"
                    alt=""
                    width={14}
                    height={14}
                    unoptimized
                  />
                  ASAH
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white/60 backdrop-blur-sm rounded-full text-[10px] font-semibold text-[#0B27BC]">
                  <Image
                    src="https://ikastarakita.com/wp-content/uploads/2026/02/asih.png"
                    alt=""
                    width={14}
                    height={14}
                    unoptimized
                  />
                  ASIH
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white/60 backdrop-blur-sm rounded-full text-[10px] font-semibold text-[#0B27BC]">
                  <Image
                    src="https://ikastarakita.com/wp-content/uploads/2026/02/asuh.png"
                    alt=""
                    width={14}
                    height={14}
                    unoptimized
                  />
                  ASUH
                </span>
              </div>
            </div>

            {/* Right — Candidate photo */}
            <div className="shrink-0 w-32 sm:w-40">
              <Image
                src="/foto-adit-ikastarakita.png"
                alt="Aditya Syarief Darmasetiawan"
                width={160}
                height={200}
                className="w-full h-auto drop-shadow-lg"
                unoptimized
                priority
              />
            </div>
          </div>
        </div>
      </div>

      {/* Form Section */}
      <div className="max-w-lg mx-auto px-4 -mt-3 relative z-10 pb-8">
        <div className="bg-white rounded-2xl shadow-[0_10px_40px_-10px_rgba(11,39,188,0.08)] overflow-hidden">
          {/* Pink accent line */}
          <div className="h-1 bg-gradient-to-r from-[#FE8DA1] via-[#fcb7c3] to-[#FE8DA1]" />

          {/* Form header */}
          <div className="px-6 pt-6 pb-1">
            <div className="flex items-center gap-2 mb-1">
              <Heart className="w-4 h-4 text-[#FE8DA1]" />
              <h2 className="text-base font-bold text-gray-900">
                Formulir Dukungan
              </h2>
            </div>
            <p className="text-xs text-gray-500">
              Dukung Aditya Syarief untuk Ikastara yang lebih baik.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            {error && (
              <div className="px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
                {error}
              </div>
            )}

            {/* Row: Nama + Angkatan */}
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Nama Lengkap <span className="text-[#FE8DA1]">*</span>
                </label>
                <input
                  type="text"
                  name="nama"
                  value={form.nama}
                  onChange={handleChange}
                  required
                  placeholder="Nama lengkap"
                  className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FE8DA1]/30 focus:border-[#FE8DA1] transition-colors placeholder:text-gray-300"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Angkatan <span className="text-[#FE8DA1]">*</span>
                </label>
                <select
                  name="angkatan"
                  value={form.angkatan}
                  onChange={handleChange}
                  required
                  className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FE8DA1]/30 focus:border-[#FE8DA1] transition-colors bg-white"
                >
                  <option value="">Pilih</option>
                  {ANGKATAN_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      TN{n}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row: WhatsApp + Email */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                No. WhatsApp <span className="text-[#FE8DA1]">*</span>
              </label>
              <input
                type="tel"
                name="no_hp"
                value={form.no_hp}
                onChange={handleChange}
                required
                placeholder="08xxxxxxxxxx"
                className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FE8DA1]/30 focus:border-[#FE8DA1] transition-colors placeholder:text-gray-300"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Email <span className="text-[#FE8DA1]">*</span>
              </label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
                placeholder="email@contoh.com"
                className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FE8DA1]/30 focus:border-[#FE8DA1] transition-colors placeholder:text-gray-300"
              />
            </div>

            {/* Domisili */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {`Domisili (Kota, Provinsi) (Opsional)`}
              </label>
              <input
                type="text"
                name="domisili"
                value={form.domisili}
                onChange={handleChange}
                placeholder="Jakarta Selatan, DKI Jakarta"
                className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FE8DA1]/30 focus:border-[#FE8DA1] transition-colors placeholder:text-gray-300"
              />
            </div>

            {/* Harapan */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {`Harapan untuk Ikastara ke Depan (Opsional)`}
              </label>
              <textarea
                name="harapan"
                value={form.harapan}
                onChange={handleChange}
                rows={2}
                placeholder="Tulis harapan Anda..."
                className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FE8DA1]/30 focus:border-[#FE8DA1] transition-colors resize-none placeholder:text-gray-300"
              />
            </div>

            {/* Referral */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {`Referral (opsional)`}
              </label>
              <label className="block text-[11px] text-gray-600 mb-1">
                {`Silahkan diisi (jika ada) siapa abang/kakak yang mengajak bergabung di Ikastara Kita ? (bisa diisi dengan nama, angkatan)`}
              </label>
              <input
                type="text"
                name="referral_name"
                value={form.referral_name}
                onChange={handleChange}
                placeholder="Referral (opsional)"
                className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FE8DA1]/30 focus:border-[#FE8DA1] transition-colors placeholder:text-gray-300"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[#0B27BC] text-white font-semibold rounded-xl hover:bg-[#091fa0] active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed text-sm shadow-lg shadow-[#0B27BC]/20"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Mengirim...
                </>
              ) : (
                <>
                  <Heart className="w-4 h-4" />
                  Kirim Dukungan
                </>
              )}
            </button>

            <p className="text-center text-[11px] text-gray-400 pt-1">
              Data dijaga kerahasiaannya dan hanya untuk keperluan Ikastara
              Kita.
            </p>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center pt-5 pb-2 space-y-1.5">
          <div className="flex items-center justify-center gap-3">
            <a
              href="https://instagram.com/ikastarakita"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-gray-400 hover:text-[#0B27BC] transition-colors"
            >
              @ikastarakita
            </a>
            <span className="text-gray-300">·</span>
            <a
              href="https://ikastarakita.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-gray-400 hover:text-[#0B27BC] transition-colors"
            >
              ikastarakita.com
            </a>
            <span className="text-gray-300">·</span>
            <a
              href="https://wa.me/6285752929399"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-gray-400 hover:text-[#0B27BC] transition-colors"
            >
              0857-5292-9399
            </a>
          </div>
          <p className="text-[10px] text-gray-300">
            Untuk alumni, oleh alumni, dan demi masa depan Taruna Nusantara.
          </p>
        </div>
      </div>
    </div>
  );
}
