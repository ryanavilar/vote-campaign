"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { Member } from "@/lib/types";

interface MemberFormProps {
  member?: Member;
  allMembers?: Member[];
  onSave: (data: Partial<Member>) => void;
  onCancel: () => void;
}

const angkatanOptions = Array.from({ length: 33 }, (_, i) => i + 1);

export function MemberForm({ member, allMembers, onSave, onCancel }: MemberFormProps) {
  const [nama, setNama] = useState(member?.nama || "");
  const [angkatan, setAngkatan] = useState<number>(member?.angkatan || 1);
  const [noHp, setNoHp] = useState(member?.no_hp || "");
  const [pic, setPic] = useState(member?.pic || "");
  const [referralName, setReferralName] = useState(member?.referral_name || "");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nama.trim()) return;

    setLoading(true);
    try {
      await onSave({
        ...(member ? { id: member.id } : {}),
        nama: nama.trim(),
        angkatan,
        no_hp: noHp.trim(),
        pic: pic.trim() || null,
        referral_name: referralName.trim() || null,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-border p-4 sm:p-6 space-y-4">
      <h3 className="font-semibold text-foreground">
        {member ? "Edit Anggota" : "Tambah Anggota Baru"}
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Nama */}
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-foreground mb-1">
            Nama Lengkap <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            placeholder="Masukkan nama lengkap"
            required
            className="w-full px-4 py-3 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC]"
          />
        </div>

        {/* Angkatan */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Angkatan <span className="text-red-500">*</span>
          </label>
          <select
            value={angkatan}
            onChange={(e) => setAngkatan(Number(e.target.value))}
            className="w-full px-4 py-3 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC] bg-white"
          >
            {angkatanOptions.map((a) => (
              <option key={a} value={a}>
                TN {a}
              </option>
            ))}
          </select>
        </div>

        {/* No HP */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            No. HP
          </label>
          <input
            type="tel"
            value={noHp}
            onChange={(e) => setNoHp(e.target.value)}
            placeholder="08xxxxxxxxxx"
            className="w-full px-4 py-3 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC]"
          />
        </div>

        {/* PIC */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            PIC (Penanggung Jawab)
          </label>
          <input
            type="text"
            value={pic}
            onChange={(e) => setPic(e.target.value)}
            placeholder="Nama PIC"
            className="w-full px-4 py-3 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC]"
          />
        </div>

        {/* Referral Name */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Direferensikan Oleh
          </label>
          <input
            type="text"
            value={referralName}
            onChange={(e) => setReferralName(e.target.value)}
            placeholder="Ketik nama yang mereferensikan"
            className="w-full px-4 py-3 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC]"
          />
        </div>
      </div>

      {/* Buttons */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={loading || !nama.trim()}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-[#0B27BC] rounded-lg hover:bg-[#091fa0] transition-colors disabled:opacity-50"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {member ? "Simpan Perubahan" : "Tambah Anggota"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          Batal
        </button>
      </div>
    </form>
  );
}
