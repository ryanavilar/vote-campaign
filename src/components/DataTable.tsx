"use client";

import type { Member, StatusValue } from "@/lib/types";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

interface DataTableProps {
  data: Member[];
  onUpdate?: (id: string, field: string, value: StatusValue) => void;
  onRowClick?: (id: string) => void;
  totalCount: number;
}

const PAGE_SIZE = 25;

function StatusBadge({
  value,
  onChange,
}: {
  value: StatusValue;
  onChange?: (v: StatusValue) => void;
}) {
  const colors = {
    Sudah: "bg-emerald-100 text-emerald-700 border-emerald-200",
    Belum: "bg-red-100 text-red-700 border-red-200",
  };

  const colorClass = value ? colors[value] : "bg-gray-50 text-gray-400 border-gray-200";

  if (!onChange) {
    return (
      <span className={`text-xs font-medium px-2 py-1 rounded-md border inline-block ${colorClass}`}>
        {value || "-"}
      </span>
    );
  }

  return (
    <select
      value={value || ""}
      onChange={(e) => onChange((e.target.value || null) as StatusValue)}
      onClick={(e) => e.stopPropagation()}
      className={`text-xs font-medium px-2 py-1 rounded-md border cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#0B27BC]/30 ${colorClass}`}
    >
      <option value="">-</option>
      <option value="Sudah">Sudah</option>
      <option value="Belum">Belum</option>
    </select>
  );
}

export function DataTable({ data, onUpdate, onRowClick, totalCount }: DataTableProps) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(data.length / PAGE_SIZE);
  const pageData = data.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="font-semibold text-foreground text-sm">
          Data Anggota{" "}
          <span className="font-normal text-muted-foreground">
            ({data.length} dari {totalCount})
          </span>
        </h3>
        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs text-muted-foreground">
            {page + 1} / {Math.max(1, totalPages)}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
            className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#0B27BC]/5">
              <th className="px-3 py-2.5 text-left font-semibold text-xs text-[#0B27BC]/70 uppercase tracking-wider w-10">
                No
              </th>
              <th className="px-3 py-2.5 text-left font-semibold text-xs text-[#0B27BC]/70 uppercase tracking-wider min-w-[180px]">
                Nama
              </th>
              <th className="px-3 py-2.5 text-center font-semibold text-xs text-[#0B27BC]/70 uppercase tracking-wider w-20">
                TN
              </th>
              <th className="px-3 py-2.5 text-left font-semibold text-xs text-[#0B27BC]/70 uppercase tracking-wider w-[140px]">
                No. HP
              </th>
              <th className="px-3 py-2.5 text-center font-semibold text-xs text-[#0B27BC]/70 uppercase tracking-wider w-[100px]">
                Status DPT
              </th>
              <th className="px-3 py-2.5 text-center font-semibold text-xs text-[#0B27BC]/70 uppercase tracking-wider w-[100px]">
                Dikontak
              </th>
              <th className="px-3 py-2.5 text-center font-semibold text-xs text-[#0B27BC]/70 uppercase tracking-wider w-[100px]">
                Masuk Grup
              </th>
              <th className="px-3 py-2.5 text-center font-semibold text-xs text-[#0B27BC]/70 uppercase tracking-wider w-[100px]">
                Vote
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {pageData.map((member) => (
              <tr
                key={member.id}
                onClick={onRowClick ? () => onRowClick(member.id) : undefined}
                className={`hover:bg-[#0B27BC]/[0.02] transition-colors ${onRowClick ? "cursor-pointer" : ""}`}
              >
                <td className="px-3 py-2 text-muted-foreground">{member.no}</td>
                <td className="px-3 py-2 font-medium text-foreground">
                  {member.nama}
                </td>
                <td className="px-3 py-2 text-center">
                  <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-[#0B27BC]/10 text-[#0B27BC] text-xs font-medium">
                    TN{member.angkatan}
                  </span>
                </td>
                <td className="px-3 py-2 text-muted-foreground font-mono text-xs">
                  {member.no_hp}
                </td>
                <td className="px-3 py-2 text-center">
                  <StatusBadge
                    value={member.status_dpt}
                    onChange={onUpdate ? (v) => onUpdate(member.id, "status_dpt", v) : undefined}
                  />
                </td>
                <td className="px-3 py-2 text-center">
                  <StatusBadge
                    value={member.sudah_dikontak}
                    onChange={onUpdate ? (v) => onUpdate(member.id, "sudah_dikontak", v) : undefined}
                  />
                </td>
                <td className="px-3 py-2 text-center">
                  <StatusBadge
                    value={member.masuk_grup}
                    onChange={onUpdate ? (v) => onUpdate(member.id, "masuk_grup", v) : undefined}
                  />
                </td>
                <td className="px-3 py-2 text-center">
                  <StatusBadge
                    value={member.vote}
                    onChange={onUpdate ? (v) => onUpdate(member.id, "vote", v) : undefined}
                  />
                </td>
              </tr>
            ))}
            {pageData.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                  Tidak ada data yang cocok dengan filter
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
