"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { ArrowRight, ExternalLink, Search } from "lucide-react";

const ROMAN: Record<number, string> = {
  1: "I", 2: "II", 3: "III", 4: "IV", 5: "V", 6: "VI", 7: "VII", 8: "VIII",
  9: "IX", 10: "X", 11: "XI", 12: "XII", 13: "XIII", 14: "XIV", 15: "XV", 16: "XVI",
  17: "XVII", 18: "XVIII", 19: "XIX", 20: "XX", 21: "XXI", 22: "XXII", 23: "XXIII", 24: "XXIV",
  25: "XXV", 26: "XXVI", 27: "XXVII", 28: "XXVIII", 29: "XXIX", 30: "XXX", 31: "XXXI", 32: "XXXII", 33: "XXXIII",
};

const FORMS: Record<number, string> = {
  1: "https://forms.gle/sVT2FprGMQUwxgoq7",
  2: "https://forms.gle/6WRx5snWeKoPFuJ4A",
  3: "https://forms.gle/pzaVkRGokkRL8Xwy8",
  4: "https://forms.gle/4kDNTCiqbnobSwSd8",
  5: "https://forms.gle/W6hMVNsKRD52W5SK8",
  6: "https://forms.gle/88NkaLCgz3w3Z2JY9",
  7: "https://forms.gle/UTUudrJHArpLFHDC9",
  8: "https://forms.gle/ER6QrZ9kKneMLjvi8",
  9: "https://forms.gle/vvfZVaAaoMJj5zud8",
  10: "https://forms.gle/LFrn3jCy2gSxSuke9",
  11: "https://forms.gle/4PEA6UCcGkz6qbhk7",
  12: "https://forms.gle/v7DMHKBVLEf5Z2Xa8",
  13: "https://forms.gle/oCuTfpLoRCL2JUV6A",
  14: "https://forms.gle/pjQo52FG4jTEAYJ2A",
  15: "https://forms.gle/mvpfJmxxyn99CrZz5",
  16: "https://forms.gle/tCHBbBSJXfVg1Jwg9",
  17: "https://forms.gle/fU5iRumGsYCyD9BdA",
  18: "https://forms.gle/Kt7xFWvmtWNEz4pU7",
  19: "https://forms.gle/GS5XZk6G343je5mw5",
  20: "https://forms.gle/gHPTeezSiVRdaGVs7",
  21: "https://forms.gle/jYFARhnn1f6TXYd6A",
  22: "https://forms.gle/jJ1yyMH9Yn7XCgtk9",
  23: "https://forms.gle/UDbnQZgpxsAwrzWA8",
  24: "https://forms.gle/LtZCqvEyZ7UEeFwo7",
  25: "https://forms.gle/2FApKm48NewCMfLS9",
  26: "https://forms.gle/zXaGNPKG3b9HFHie9",
  27: "https://forms.gle/8Ds7g64K4ZCCeHy77",
  28: "https://forms.gle/zFHauCGecmW3nndA9",
  29: "https://forms.gle/rvs4pcCD7LT48SkB6",
  30: "https://forms.gle/ZXyjoGYzYXBmBCfN9",
  31: "https://forms.gle/BmaQ6f6gAoAYfwGo6",
  32: "https://forms.gle/dnbK3hfykrKedooMA",
  33: "https://forms.gle/cPLBzYabBVYKP5Ht5",
};

export default function PilihAngkatanFormPage() {
  const [selected, setSelected] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return Object.keys(FORMS).map(Number).sort((a, b) => a - b);
    const q = search.trim().toLowerCase();
    return Object.keys(FORMS).map(Number).filter((a) => {
      const r = ROMAN[a].toLowerCase();
      return String(a).includes(q) || `tn${a}`.includes(q) || `tn ${a}`.includes(q) || r.includes(q);
    }).sort((a, b) => a - b);
  }, [search]);

  const handleGo = () => {
    if (!selected) return;
    const url = FORMS[selected];
    if (url) window.location.href = url;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0B27BC] via-[#0B27BC] to-[#84303F] flex flex-col">
      {/* Hero */}
      <header className="px-6 py-6 sm:py-8 text-white">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Image src="/images/logo-dark.png" alt="Ikastara Kita" width={48} height={48} className="rounded-lg bg-white p-1" />
          <div>
            <h1 className="text-lg sm:text-xl font-bold">Ikastara Kita</h1>
            <p className="text-xs text-white/70">Form DPT Munas XI Ikastara 2026</p>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 sm:px-6 pb-10">
        <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Pink stripe */}
          <div className="h-1.5 bg-gradient-to-r from-[#fcb7c3] via-[#FE8DA1] to-[#fcb7c3]" />

          <div className="p-5 sm:p-7 space-y-5">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-[#0B27BC]">
                Pilih Angkatan Anda
              </h2>
              <p className="text-sm text-gray-600 mt-1.5">
                Klik angkatan SMA TN Anda di bawah, lalu tekan tombol <b>Lanjut ke Form DPT</b>. Anda akan diarahkan ke Google Form khusus angkatan tersebut.
              </p>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari angkatan (mis. 18, TN18, XVIII)…"
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/30 focus:border-[#0B27BC]"
              />
            </div>

            {/* Grid of angkatan */}
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-2">
              {filtered.map((a) => {
                const active = selected === a;
                return (
                  <button
                    key={a}
                    onClick={() => setSelected(a)}
                    className={`relative px-2 py-3 rounded-xl border-2 transition-all text-center ${
                      active
                        ? "bg-[#0B27BC] text-white border-[#0B27BC] shadow-lg scale-105"
                        : "bg-white text-gray-700 border-gray-200 hover:border-[#0B27BC]/50 hover:bg-[#0B27BC]/5"
                    }`}
                  >
                    <div className={`text-base font-bold ${active ? "text-white" : "text-[#0B27BC]"}`}>TN {a}</div>
                    <div className={`text-[10px] mt-0.5 ${active ? "text-white/80" : "text-gray-400"}`}>Angkatan {ROMAN[a]}</div>
                  </button>
                );
              })}
            </div>

            {filtered.length === 0 && (
              <div className="text-center py-6 text-sm text-gray-500">
                Angkatan tidak ditemukan. Coba ketik nomor saja, mis. 18.
              </div>
            )}

            {/* CTA */}
            <div className="pt-2">
              <button
                onClick={handleGo}
                disabled={!selected}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all bg-[#0B27BC] text-white hover:bg-[#091e94] shadow-md disabled:bg-gray-300 disabled:cursor-not-allowed disabled:shadow-none"
              >
                {selected ? (
                  <>
                    Lanjut ke Form DPT TN {selected}
                    <ArrowRight className="w-4 h-4" />
                  </>
                ) : (
                  <>Pilih angkatan dulu</>
                )}
              </button>
              {selected && (
                <p className="text-[11px] text-center text-gray-500 mt-2">
                  Anda akan dibawa ke{" "}
                  <span className="inline-flex items-center gap-0.5 font-medium text-gray-700">
                    forms.gle <ExternalLink className="w-3 h-3" />
                  </span>{" "}
                  milik Panitia Munas IKASTARA XI 2026.
                </p>
              )}
            </div>
          </div>

          {/* Info box */}
          <div className="px-5 sm:px-7 py-4 bg-gray-50 border-t border-gray-100">
            <p className="text-[11px] text-gray-500 leading-relaxed">
              💡 <b>Tips:</b> Setelah isi GForm, jangan lupa juga registrasi di website{" "}
              <a href="https://evote.ikastara.or.id" target="_blank" rel="noopener noreferrer" className="text-[#0B27BC] underline font-medium">
                evote.ikastara.or.id
              </a>
              {" "}untuk verifikasi selfie. Deadline GForm: 10 Mei 2026 · Web: 16 Mei 2026.
            </p>
          </div>
        </div>

        <p className="text-center text-[11px] text-white/60 mt-6">
          Ikastara Kita · Munas XI IKASTARA 2026
        </p>
      </main>
    </div>
  );
}
