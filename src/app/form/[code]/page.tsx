"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import {
  Loader2,
  CheckCircle,
  Calendar,
  MapPin,
  AlertCircle,
  UserPlus,
} from "lucide-react";

const ANGKATAN_OPTIONS = Array.from({ length: 33 }, (_, i) => i + 1);

interface EventInfo {
  id: string;
  nama: string;
  jenis: string;
  deskripsi: string | null;
  lokasi: string | null;
  tanggal: string;
  status: string;
  checkin_code: string;
}

export default function EventFormPage() {
  const { code } = useParams<{ code: string }>();

  const [event, setEvent] = useState<EventInfo | null>(null);
  const [eventLoading, setEventLoading] = useState(true);
  const [eventError, setEventError] = useState("");

  const [form, setForm] = useState({
    nama: "",
    angkatan: "",
    no_hp: "",
    will_attend: "ya",
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successData, setSuccessData] = useState<{
    member_name: string;
    event_name: string | null;
  } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchEvent = async () => {
      setEventLoading(true);
      try {
        const res = await fetch(
          `/api/public/event?code=${encodeURIComponent(code)}`
        );
        const data = await res.json();

        if (!res.ok) {
          setEventError(data.error || "Kegiatan tidak ditemukan");
          return;
        }

        setEvent(data.event);
      } catch {
        setEventError("Gagal memuat data kegiatan. Periksa koneksi internet.");
      } finally {
        setEventLoading(false);
      }
    };

    if (code) {
      fetchEvent();
    }
  }, [code]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
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
          type: "event",
          nama: form.nama.trim(),
          angkatan: Number(form.angkatan),
          no_hp: form.no_hp.trim(),
          checkin_code: code.toUpperCase(),
          will_attend: form.will_attend === "ya",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Terjadi kesalahan. Silakan coba lagi.");
        return;
      }

      setSuccessData({
        member_name: data.member_name,
        event_name: data.event_name,
      });
      setSuccess(true);
    } catch {
      setError("Gagal mengirim formulir. Periksa koneksi internet Anda.");
    } finally {
      setLoading(false);
    }
  };

  const formatTanggal = (tanggal: string) => {
    return new Date(tanggal).toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Loading state
  if (eventLoading) {
    return (
      <div className="min-h-screen bg-[#fcb7c3] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#0B27BC]" />
          <p className="text-sm text-[#84303F]/70">Memuat kegiatan...</p>
        </div>
      </div>
    );
  }

  // Event not found / error
  if (eventError || !event) {
    return (
      <div className="min-h-screen bg-[#fcb7c3] flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-white rounded-2xl p-8 shadow-[0_10px_40px_-10px_rgba(11,39,188,0.12)] space-y-4">
            <div className="mx-auto w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
              <AlertCircle className="w-7 h-7 text-red-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">
              Kegiatan Tidak Ditemukan
            </h2>
            <p className="text-sm text-gray-600">
              {eventError ||
                "Kode kegiatan tidak valid atau kegiatan sudah berakhir."}
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 mt-4">
            <a
              href="https://instagram.com/ikastarakita"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#84303F]/60 hover:text-[#84303F] transition-colors"
            >
              @ikastarakita
            </a>
            <span className="text-[#84303F]/30">&middot;</span>
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

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-[#fcb7c3] flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md text-center space-y-5">
          <div className="bg-white rounded-2xl p-8 shadow-[0_10px_40px_-10px_rgba(11,39,188,0.12)] space-y-5">
            <div className="mx-auto w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-[#0B27BC]">
              {form.will_attend === "ya"
                ? "Pendaftaran Berhasil!"
                : "Terima Kasih!"}
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              {form.will_attend === "ya" ? (
                <>
                  Hai <span className="font-semibold">{successData?.member_name}</span>, kamu sudah terdaftar untuk kegiatan{" "}
                  <span className="font-semibold">{successData?.event_name}</span>. Sampai jumpa di acara!
                </>
              ) : (
                <>
                  Terima kasih sudah mengisi formulir, <span className="font-semibold">{successData?.member_name}</span>. Semoga bisa ikut di kesempatan berikutnya!
                </>
              )}
            </p>
            {event && (
              <div className="bg-[#fcb7c3]/20 rounded-xl p-4 text-left space-y-2">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Calendar className="w-4 h-4 shrink-0 text-[#FE8DA1]" />
                  <span>{formatTanggal(event.tanggal)}</span>
                </div>
                {event.lokasi && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <MapPin className="w-4 h-4 shrink-0 text-[#FE8DA1]" />
                    <span>{event.lokasi}</span>
                  </div>
                )}
              </div>
            )}
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
            <span className="text-[#84303F]/30">&middot;</span>
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero — Pink background */}
      <div className="bg-[#fcb7c3] relative overflow-hidden">
        {/* Decorative glow */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-[#FE8DA1]/40 rounded-full blur-3xl -translate-y-1/3 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#0B27BC]/10 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4" />

        <div className="max-w-lg mx-auto px-5 pt-6 pb-6 relative">
          {/* Logo */}
          <Image
            src="https://ikastarakita.com/wp-content/uploads/2026/02/logo-ikastara-small.png"
            alt="Ikastara Kita"
            width={120}
            height={40}
            className="mb-3"
            unoptimized
          />

          {/* Event badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/60 backdrop-blur-sm rounded-full mb-3">
            <Calendar className="w-3.5 h-3.5 text-[#0B27BC]" />
            <span className="text-[10px] font-semibold text-[#0B27BC] uppercase tracking-wide">
              Pendaftaran Kegiatan
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl font-bold text-[#0B27BC] leading-tight mb-2">
            {event.nama}
          </h1>
          <p className="text-xs text-[#84303F]/70">
            Ikastara Kita &mdash; Aditya Syarief
          </p>

          {/* Event Info */}
          <div className="mt-4 bg-white/60 backdrop-blur-sm rounded-xl p-3.5 space-y-2">
            <div className="flex items-center gap-2 text-sm text-[#84303F]">
              <Calendar className="w-4 h-4 shrink-0 text-[#FE8DA1]" />
              <span>{formatTanggal(event.tanggal)}</span>
            </div>
            {event.lokasi && (
              <div className="flex items-center gap-2 text-sm text-[#84303F]">
                <MapPin className="w-4 h-4 shrink-0 text-[#FE8DA1]" />
                <span>{event.lokasi}</span>
              </div>
            )}
            {event.deskripsi && (
              <p className="text-xs text-[#84303F]/60 pt-0.5">{event.deskripsi}</p>
            )}
          </div>
        </div>
      </div>

      {/* Form Section */}
      <div className="max-w-lg mx-auto px-4 -mt-3 relative z-10 pb-8">
        <div className="bg-white rounded-2xl shadow-[0_10px_40px_-10px_rgba(11,39,188,0.08)] overflow-hidden">
          {/* Pink accent line */}
          <div className="h-1 bg-gradient-to-r from-[#FE8DA1] via-[#fcb7c3] to-[#FE8DA1]" />

          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            {error && (
              <div className="px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
                {error}
              </div>
            )}

            {/* Nama + Angkatan */}
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

            {/* No WhatsApp */}
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

            {/* Kehadiran */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-600">
                Apakah Anda akan hadir? <span className="text-[#FE8DA1]">*</span>
              </label>
              <div className="flex gap-3">
                <label
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all ${
                    form.will_attend === "ya"
                      ? "border-[#FE8DA1] bg-[#FE8DA1]/5 text-[#84303F]"
                      : "border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="will_attend"
                    value="ya"
                    checked={form.will_attend === "ya"}
                    onChange={handleChange}
                    className="sr-only"
                  />
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">Ya, saya hadir</span>
                </label>
                <label
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all ${
                    form.will_attend === "tidak"
                      ? "border-gray-600 bg-gray-50 text-gray-700"
                      : "border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="will_attend"
                    value="tidak"
                    checked={form.will_attend === "tidak"}
                    onChange={handleChange}
                    className="sr-only"
                  />
                  <span className="text-sm font-medium">Tidak bisa hadir</span>
                </label>
              </div>
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
                  <UserPlus className="w-4 h-4" />
                  Daftar Sekarang
                </>
              )}
            </button>

            <p className="text-center text-[11px] text-gray-400 pt-1">
              Data dijaga kerahasiaannya dan hanya untuk keperluan Ikastara Kita.
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
            <span className="text-gray-300">&middot;</span>
            <a
              href="https://ikastarakita.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-gray-400 hover:text-[#0B27BC] transition-colors"
            >
              ikastarakita.com
            </a>
            <span className="text-gray-300">&middot;</span>
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
