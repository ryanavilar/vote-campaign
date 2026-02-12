"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { MessageSquare, Loader2, Search, User } from "lucide-react";
import type { Member } from "@/lib/types";
import { useRouter } from "next/navigation";

export default function HarapanPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const { data, error } = await supabase
        .from("members")
        .select("*")
        .not("harapan", "is", null)
        .neq("harapan", "")
        .order("no", { ascending: true });

      if (!error && data) {
        setMembers(data);
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return members;
    const q = searchQuery.toLowerCase();
    return members.filter(
      (m) =>
        m.nama.toLowerCase().includes(q) ||
        m.harapan?.toLowerCase().includes(q)
    );
  }, [members, searchQuery]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#0B27BC]" />
          <p className="text-sm text-muted-foreground">Memuat harapan...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0B27BC] text-white shadow-lg">
        <div className="px-4 sm:px-6 py-3">
          <div className="flex items-center gap-3">
            <MessageSquare className="w-5 h-5 text-[#FE8DA1]" />
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-white">
                Harapan untuk Ikastara
              </h1>
              <p className="text-xs text-white/70">
                {members.length} harapan dari anggota
              </p>
            </div>
          </div>
        </div>
        <div className="h-1 bg-gradient-to-r from-[#fcb7c3] via-[#FE8DA1] to-[#fcb7c3]" />
      </header>

      <div className="px-4 sm:px-6 py-6 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama atau harapan..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC] bg-white"
          />
        </div>

        {/* Harapan Cards */}
        {filteredMembers.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12">
            <MessageSquare className="w-10 h-10 text-gray-300" />
            <p className="text-sm text-muted-foreground">
              {searchQuery
                ? "Tidak ada harapan yang cocok"
                : "Belum ada harapan yang diisi"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMembers.map((member) => (
              <button
                key={member.id}
                onClick={() => router.push(`/anggota/${member.id}`)}
                className="bg-white rounded-xl border border-border p-4 shadow-sm text-left hover:shadow-md hover:border-[#0B27BC]/20 transition-all"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-full bg-[#0B27BC]/10 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-[#0B27BC]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {member.nama}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      TN{member.angkatan}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap line-clamp-4">
                  {member.harapan}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
