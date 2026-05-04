"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown, AlertTriangle, CheckCircle2, Globe, Smartphone, FileText, ShieldCheck, ArrowRight, ExternalLink } from "lucide-react";

function PanitiaLink({ children }: { children: React.ReactNode }) {
  return (
    <a
      href="https://wa.me/628119881660"
      target="_blank"
      rel="noopener noreferrer"
      className="font-semibold text-[#0B27BC] underline underline-offset-2 hover:text-[#091e94]"
    >
      {children}
    </a>
  );
}

type Step = {
  num: number;
  title: string;
  short: string;
  body: React.ReactNode;
  tone: "ok" | "warn" | "info";
};

const STEPS: Step[] = [
  {
    num: 1,
    title: "Isi GForm Pendataan Angkatan",
    short: "Mulai dari GForm angkatan masing-masing.",
    tone: "info",
    body: (
      <div className="space-y-2 text-sm">
        <p>
          Setiap angkatan punya GForm tersendiri. Pastikan kamu mengisi GForm
          angkatan yang benar.
        </p>
        <ul className="list-disc list-inside space-y-1 text-gray-700">
          <li>Nosis harus persis sama dengan Master Data NOSIS (cek link di FAQ #6).</li>
          <li>No HP yang didaftarkan <b>harus sama</b> dengan nomor HP yang ada di grup WhatsApp angkatan masing-masing — supaya verifikator bisa validasi.</li>
          <li>Pastikan nama lengkap sesuai data resmi.</li>
        </ul>
        <Link href="/form/gform" className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 text-xs font-semibold text-white bg-[#0B27BC] rounded-lg hover:bg-[#091e94]">
          Pilih Angkatan & Buka GForm <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    ),
  },
  {
    num: 2,
    title: "Salah Form Angkatan? Otomatis Ditolak",
    short: "Hati-hati pilih form yang sesuai angkatanmu.",
    tone: "warn",
    body: (
      <div className="space-y-2 text-sm text-gray-700">
        <p>
          Kalau kamu angkatan 20 tapi isi GForm angkatan 21 (atau angkatan
          lain), submission kamu akan <b>ditolak verifikator</b>.
        </p>
        <p>
          Solusi: cek link GForm yang dibagikan tim verifikator angkatanmu, atau{" "}
          <Link href="/form/gform" className="font-semibold text-[#0B27BC] underline underline-offset-2 hover:text-[#091e94]">
            gunakan halaman pemilih angkatan ini
          </Link>{" "}
          agar tidak salah.
        </p>
      </div>
    ),
  },
  {
    num: 3,
    title: "No HP Tidak Match Grup WA Angkatan? Ditolak Verifikator",
    short: "Pastikan No HP sama persis dengan yang ada di grup WA angkatan.",
    tone: "warn",
    body: (
      <div className="space-y-2 text-sm text-gray-700">
        <p>
          Verifikator angkatan akan mencocokkan No HP yang kamu input di GForm
          dengan daftar nomor di grup WhatsApp angkatan. Kalau beda, GForm kamu
          akan <b>ditolak</b>.
        </p>
        <p className="text-amber-700">
          ⚠️ Tips: kalau kamu pernah ganti nomor, pastikan grup WA pakai nomor
          terbaru juga sebelum isi GForm — atau pakai nomor lama yang masih
          terdaftar di grup.
        </p>
      </div>
    ),
  },
  {
    num: 4,
    title: "GForm Sudah Disetujui? Lanjut Daftar Web DPT",
    short: "Ke evote.ikastara.or.id untuk registrasi lengkap.",
    tone: "ok",
    body: (
      <div className="space-y-2 text-sm text-gray-700">
        <p>
          Setelah verifikator angkatan approve GForm-mu, kamu bisa lanjut
          registrasi di website resmi Munas:
        </p>
        <a
          href="https://evote.ikastara.or.id"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#84303F] rounded-lg hover:bg-[#6a2632]"
        >
          Buka evote.ikastara.or.id <ExternalLink className="w-3.5 h-3.5" />
        </a>
        <p className="text-amber-700 text-[12px]">
          ⏳ <b>Setelah ~24 jam</b> dari GForm disetujui verifikator, baru data
          bisa dipakai untuk daftar di evote. Sync GForm → website jalan{" "}
          <b>tiap hari</b>, jadi tunggu sehari setelah approval.
        </p>
      </div>
    ),
  },
  {
    num: 5,
    title: "Web Error / Tidak Bisa Akses?",
    short: "Cek koneksi, pakai Chrome, hapus cookie / coba Incognito.",
    tone: "warn",
    body: (
      <div className="space-y-2 text-sm text-gray-700">
        <p>Kalau muncul tulisan Server Error, &ldquo;tidak ada internet&rdquo;, atau halaman gak load:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Pastikan device terhubung ke internet yang <b>stabil</b>.</li>
          <li>Gunakan <b>Google Chrome</b> untuk buka web evoting.</li>
          <li>Hapus cookies & cache, atau coba <b>mode Incognito</b>.</li>
          <li>Tutup tab/aplikasi lain yang berat — biar bandwidth fokus.</li>
        </ul>
      </div>
    ),
  },
  {
    num: 6,
    title: "Input NOSIS \"Tidak Ditemukan\"",
    short: "Cek Master Data NOSIS — kalau beda, hubungi panitia.",
    tone: "warn",
    body: (
      <div className="space-y-2 text-sm text-gray-700">
        <p>
          Indikasinya: NOSIS / nama yang kamu validasi di GForm berbeda dengan
          Master Data NOSIS yang dipegang panitia.
        </p>
        <a
          href="https://docs.google.com/spreadsheets/d/1JCV8PBbWTeKJh0zxzZru08zwmUXY4KqLhEE24aOvm4A/edit?gid=1779616051#gid=1779616051"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0B27BC] border border-[#0B27BC]/30 rounded-lg hover:bg-[#0B27BC]/5"
        >
          Cek Master Data NOSIS <ExternalLink className="w-3.5 h-3.5" />
        </a>
        <p>
          Kalau beda, segera hubungi <PanitiaLink>panitia (Ikhsan)</PanitiaLink> untuk
          pembetulan data. Setelah dibetulkan, biasanya panitia minta kamu{" "}
          <b>daftar ulang GForm</b> dengan data yang benar.
        </p>
      </div>
    ),
  },
  {
    num: 7,
    title: "OTP WhatsApp Tidak Masuk?",
    short: "Cek apakah ada typo nomor — kontak panitia untuk koreksi.",
    tone: "warn",
    body: (
      <div className="space-y-2 text-sm text-gray-700">
        <p>
          Kalau OTP tidak masuk-masuk setelah beberapa kali percobaan, biasanya
          ada <b>typo</b> di nomor HP yang terdaftar — sehingga OTP terkirim ke
          nomor yang salah / tidak ada.
        </p>
        <p>
          Solusi: kontak <PanitiaLink>panitia (Ikhsan)</PanitiaLink>, minta perbaikan
          nomor HP di sistem. Setelah dibetulkan, coba kirim OTP lagi.
        </p>
      </div>
    ),
  },
  {
    num: 8,
    title: "OTP Sudah Konfirmasi — Tinggal Menunggu Finalisasi",
    short: "Verifikator yang akan finalisasi DPT-mu.",
    tone: "ok",
    body: (
      <div className="space-y-2 text-sm text-gray-700">
        <p>
          Setelah OTP WhatsApp dikonfirmasi, tugas kamu sudah selesai. Tinggal
          menunggu verifikator angkatan finalisasi statusmu menjadi DPT resmi.
        </p>
        <p className="text-emerald-700">
          ✅ Kalau status sudah DPT resmi, kamu sudah berhak vote di e-voting Munas XI.
        </p>
        <p className="text-[11px] text-gray-500">
          Deadline GForm: 10 Mei 2026 · Web DPT: 12 Mei 2026 · eVote dimulai: 16 Mei 2026 — jangan tunda!
        </p>
      </div>
    ),
  },
];

const TONE_STYLES: Record<Step["tone"], { bg: string; text: string; icon: React.ReactNode }> = {
  ok: { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700", icon: <CheckCircle2 className="w-4 h-4" /> },
  warn: { bg: "bg-amber-50 border-amber-200", text: "text-amber-700", icon: <AlertTriangle className="w-4 h-4" /> },
  info: { bg: "bg-[#0B27BC]/5 border-[#0B27BC]/20", text: "text-[#0B27BC]", icon: <FileText className="w-4 h-4" /> },
};

export default function FaqDptPage() {
  const [openSteps, setOpenSteps] = useState<Set<number>>(new Set([1]));
  const toggle = (n: number) => {
    setOpenSteps((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0B27BC] via-[#0B27BC] to-[#84303F]">
      {/* Header */}
      <header className="px-6 py-6 sm:py-8 text-white">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Image src="/images/logo-dark.png" alt="Ikastara Kita" width={48} height={48} className="rounded-lg bg-white p-1" />
          <div>
            <h1 className="text-lg sm:text-xl font-bold">Ikastara Kita</h1>
            <p className="text-xs text-white/70">Panduan & Troubleshooting Pendaftaran DPT</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 pb-12 space-y-5">
        {/* Hero card with bang adit photo */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-[#fcb7c3] via-[#FE8DA1] to-[#fcb7c3]" />
          <div className="grid sm:grid-cols-[auto_1fr] gap-4 p-5 sm:p-7 items-center">
            <div className="flex-shrink-0 mx-auto sm:mx-0">
              <Image
                src="/foto-adit-ikastarakita.png"
                alt="Aditya Syarief — Ikastara Kita"
                width={120}
                height={120}
                className="rounded-2xl border-4 border-[#FE8DA1]/30 shadow-lg"
              />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-[#0B27BC]">
                FAQ Pendaftaran DPT
              </h2>
              <p className="text-sm text-gray-600 mt-1.5 leading-relaxed">
                Munas XI IKASTARA 2026 — panduan lengkap dari isi GForm sampai
                jadi DPT resmi. Klik tiap step untuk detail & troubleshooting.
              </p>
            </div>
          </div>

          {/* Mini stats */}
          <div className="grid grid-cols-3 border-t border-gray-100 text-center text-[11px]">
            <div className="p-3">
              <div className="font-bold text-[#84303F] text-base flex items-center justify-center gap-1">
                <Smartphone className="w-4 h-4" /> 10 Mei
              </div>
              <div className="text-gray-500">Deadline GForm</div>
            </div>
            <div className="p-3 border-x border-gray-100">
              <div className="font-bold text-[#0B27BC] text-base flex items-center justify-center gap-1">
                <Globe className="w-4 h-4" /> 12 Mei
              </div>
              <div className="text-gray-500">Deadline Web DPT</div>
            </div>
            <div className="p-3">
              <div className="font-bold text-emerald-700 text-base flex items-center justify-center gap-1">
                <ShieldCheck className="w-4 h-4" /> 16 Mei
              </div>
              <div className="text-gray-500">eVote Dimulai</div>
            </div>
          </div>
        </div>

        {/* Steps accordion */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="px-5 sm:px-7 py-4 border-b border-gray-100 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#0B27BC]" />
            <h3 className="text-sm sm:text-base font-bold text-[#0B27BC]">8 Langkah Daftar DPT</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {STEPS.map((s) => {
              const open = openSteps.has(s.num);
              const tone = TONE_STYLES[s.tone];
              return (
                <div key={s.num}>
                  <button
                    onClick={() => toggle(s.num)}
                    className="w-full px-5 sm:px-7 py-3.5 flex items-start gap-3 hover:bg-gray-50/70 transition-colors text-left"
                  >
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2 ${tone.bg} ${tone.text}`}>
                      {s.num}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={tone.text}>{tone.icon}</span>
                        <span className="text-sm font-semibold text-gray-900">{s.title}</span>
                      </div>
                      <p className="text-[12px] text-gray-500 mt-0.5">{s.short}</p>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 mt-2 transition-transform ${open ? "rotate-180" : ""}`} />
                  </button>
                  {open && (
                    <div className="px-5 sm:px-7 pb-5 pl-16 sm:pl-[5.25rem]">
                      {s.body}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* CTA card */}
        <div className="bg-gradient-to-br from-[#FE8DA1] to-[#84303F] rounded-2xl shadow-2xl p-5 sm:p-7 text-white">
          <h3 className="text-lg font-bold mb-1">Yuk Daftar Sekarang!</h3>
          <p className="text-sm text-white/85 mb-4">
            Jangan tunggu deadline. Mulai dari pilih GForm angkatanmu.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/form/gform"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-[#84303F] bg-white rounded-lg hover:bg-gray-100"
            >
              Pilih Angkatan <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="https://evote.ikastara.or.id"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white border border-white/40 rounded-lg hover:bg-white/10"
            >
              Web DPT <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>

        <p className="text-center text-[11px] text-white/60">
          Ikastara Kita · Munas XI IKASTARA 2026
        </p>
      </main>
    </div>
  );
}
