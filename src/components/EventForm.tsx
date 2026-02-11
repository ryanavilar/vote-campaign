"use client";

import { useState } from "react";
import { Loader2, Save, X } from "lucide-react";
import type { Event } from "@/lib/types";

const JENIS_OPTIONS = [
  "Silaturahmi",
  "Rapat",
  "Door-to-door",
  "Rally",
  "Sosialisasi",
  "Lainnya",
] as const;

interface EventFormProps {
  event?: Event;
  onSave: (event: Event) => void;
  onCancel: () => void;
}

export function EventForm({ event, onSave, onCancel }: EventFormProps) {
  const [nama, setNama] = useState(event?.nama || "");
  const [jenis, setJenis] = useState<Event["jenis"]>(event?.jenis || "Rapat");
  const [deskripsi, setDeskripsi] = useState(event?.deskripsi || "");
  const [lokasi, setLokasi] = useState(event?.lokasi || "");
  const [tanggal, setTanggal] = useState(() => {
    if (event?.tanggal) {
      const d = new Date(event.tanggal);
      const offset = d.getTimezoneOffset();
      const local = new Date(d.getTime() - offset * 60 * 1000);
      return local.toISOString().slice(0, 16);
    }
    return "";
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isEdit = !!event;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!nama.trim()) {
      setError("Nama kegiatan wajib diisi");
      return;
    }
    if (!tanggal) {
      setError("Tanggal wajib diisi");
      return;
    }

    setLoading(true);

    try {
      const payload = {
        nama: nama.trim(),
        jenis,
        deskripsi: deskripsi.trim() || null,
        lokasi: lokasi.trim() || null,
        tanggal: new Date(tanggal).toISOString(),
      };

      const url = isEdit ? `/api/events/${event.id}` : "/api/events";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Gagal menyimpan kegiatan");
      }

      const savedEvent = await res.json();
      onSave(savedEvent);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-border p-4 sm:p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-foreground">
          {isEdit ? "Edit Kegiatan" : "Buat Kegiatan Baru"}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {error && (
        <div className="px-3 py-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label htmlFor="nama" className="block text-sm font-medium text-foreground mb-1">
            Nama Kegiatan <span className="text-red-500">*</span>
          </label>
          <input
            id="nama"
            type="text"
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            placeholder="Contoh: Rapat Koordinasi TN25"
            className="w-full px-3 py-2.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC]"
          />
        </div>

        <div>
          <label htmlFor="jenis" className="block text-sm font-medium text-foreground mb-1">
            Jenis Kegiatan <span className="text-red-500">*</span>
          </label>
          <select
            id="jenis"
            value={jenis}
            onChange={(e) => setJenis(e.target.value as Event["jenis"])}
            className="w-full px-3 py-2.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC] bg-white"
          >
            {JENIS_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="deskripsi" className="block text-sm font-medium text-foreground mb-1">
            Deskripsi
          </label>
          <textarea
            id="deskripsi"
            value={deskripsi}
            onChange={(e) => setDeskripsi(e.target.value)}
            placeholder="Deskripsi singkat kegiatan..."
            rows={3}
            className="w-full px-3 py-2.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC] resize-none"
          />
        </div>

        <div>
          <label htmlFor="lokasi" className="block text-sm font-medium text-foreground mb-1">
            Lokasi
          </label>
          <input
            id="lokasi"
            type="text"
            value={lokasi}
            onChange={(e) => setLokasi(e.target.value)}
            placeholder="Contoh: Aula Gedung A, Lt. 2"
            className="w-full px-3 py-2.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC]"
          />
        </div>

        <div>
          <label htmlFor="tanggal" className="block text-sm font-medium text-foreground mb-1">
            Tanggal & Waktu <span className="text-red-500">*</span>
          </label>
          <input
            id="tanggal"
            type="datetime-local"
            value={tanggal}
            onChange={(e) => setTanggal(e.target.value)}
            className="w-full px-3 py-2.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC]"
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          Batal
        </button>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-[#0B27BC] rounded-lg hover:bg-[#091fa0] transition-colors disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {isEdit ? "Simpan Perubahan" : "Buat Kegiatan"}
        </button>
      </div>
    </form>
  );
}
