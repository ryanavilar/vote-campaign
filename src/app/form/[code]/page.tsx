"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
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
      <div className="min-h-screen bg-gradient-to-b from-[#0B27BC] via-[#0B27BC] to-blue-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-white" />
          <p className="text-sm text-white/70">Memuat kegiatan...</p>
        </div>
      </div>
    );
  }

  // Event not found / error
  if (eventError || !event) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0B27BC] via-[#0B27BC] to-blue-900 flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-white rounded-2xl p-8 shadow-xl space-y-4">
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
          <p className="text-white/50 text-xs mt-4">
            Ikastara Kita &mdash; Aditya Syarief
          </p>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0B27BC] via-[#0B27BC] to-blue-900 flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="bg-white rounded-2xl p-8 shadow-xl space-y-5">
            <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">
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
              <div className="bg-gray-50 rounded-xl p-4 text-left space-y-2">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Calendar className="w-4 h-4 shrink-0 text-[#0B27BC]" />
                  <span>{formatTanggal(event.tanggal)}</span>
                </div>
                {event.lokasi && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <MapPin className="w-4 h-4 shrink-0 text-[#0B27BC]" />
                    <span>{event.lokasi}</span>
                  </div>
                )}
              </div>
            )}
          </div>
          <p className="text-white/50 text-xs">
            Ikastara Kita &mdash; Aditya Syarief
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0B27BC] via-[#0B27BC] to-blue-900">
      {/* Header */}
      <div className="px-4 pt-8 pb-4 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 rounded-full mb-4">
          <Calendar className="w-4 h-4 text-[#FE8DA1]" />
          <span className="text-xs font-medium text-white/90">
            Pendaftaran Kegiatan
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
          {event.nama}
        </h1>
        <p className="text-sm text-white/70 max-w-sm mx-auto">
          Ikastara Kita &mdash; Aditya Syarief
        </p>
      </div>

      <div className="px-4 pb-8">
        <div className="max-w-lg mx-auto space-y-4">
          {/* Event Info Card */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-white/80">
                <Calendar className="w-4 h-4 shrink-0 text-[#FE8DA1]" />
                <span>{formatTanggal(event.tanggal)}</span>
              </div>
              {event.lokasi && (
                <div className="flex items-center gap-2 text-sm text-white/80">
                  <MapPin className="w-4 h-4 shrink-0 text-[#FE8DA1]" />
                  <span>{event.lokasi}</span>
                </div>
              )}
              {event.deskripsi && (
                <p className="text-sm text-white/60 pt-1">{event.deskripsi}</p>
              )}
            </div>
          </div>

          {/* Form Card */}
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-[#FE8DA1] via-[#fcb7c3] to-[#FE8DA1]" />

            <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5">
              {error && (
                <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Nama Lengkap */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">
                  Nama Lengkap <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="nama"
                  value={form.nama}
                  onChange={handleChange}
                  required
                  placeholder="Masukkan nama lengkap Anda"
                  className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC] transition-colors"
                />
              </div>

              {/* Angkatan */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">
                  Angkatan <span className="text-red-500">*</span>
                </label>
                <select
                  name="angkatan"
                  value={form.angkatan}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC] transition-colors bg-white"
                >
                  <option value="">Pilih angkatan</option>
                  {ANGKATAN_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      TN{n}
                    </option>
                  ))}
                </select>
              </div>

              {/* No WhatsApp */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">
                  Nomor WhatsApp <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  name="no_hp"
                  value={form.no_hp}
                  onChange={handleChange}
                  required
                  placeholder="08xxxxxxxxxx"
                  className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC] transition-colors"
                />
              </div>

              {/* Kehadiran */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Apakah Anda akan hadir?{" "}
                  <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-3">
                  <label
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all ${
                      form.will_attend === "ya"
                        ? "border-[#0B27BC] bg-[#0B27BC]/5 text-[#0B27BC]"
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
                    <span className="text-sm font-medium">
                      Tidak bisa hadir
                    </span>
                  </label>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[#0B27BC] text-white font-semibold rounded-xl hover:bg-[#091fa0] transition-colors disabled:opacity-60 disabled:cursor-not-allowed text-sm"
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
            </form>

            <div className="px-5 sm:px-6 pb-5 sm:pb-6">
              <p className="text-center text-xs text-gray-400">
                Data Anda dijaga kerahasiaannya dan hanya digunakan untuk
                keperluan kegiatan Ikastara Kita.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
