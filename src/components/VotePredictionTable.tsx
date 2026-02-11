"use client";

import { Vote } from "lucide-react";

interface AngkatanStat {
  angkatan: string;
  angkatanNum: number;
  total: number;
  vote: number;
}

interface VotePredictionTableProps {
  data: AngkatanStat[];
  totalStats: { total: number; voteSudah: number };
}

export function VotePredictionTable({ data, totalStats }: VotePredictionTableProps) {
  const overallPct = totalStats.total > 0 ? Math.round((totalStats.voteSudah / totalStats.total) * 100) : 0;

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#84303F]/10">
            <Vote className="w-4 h-4 text-[#84303F]" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-foreground">Prediksi Vote per Angkatan</h3>
            <p className="text-xs text-muted-foreground">
              Total: {totalStats.voteSudah}/{totalStats.total} ({overallPct}%)
            </p>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Angkatan</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">Total</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">Will Vote</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">%</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground w-32">Progress</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.map((row) => {
              const pct = row.total > 0 ? Math.round((row.vote / row.total) * 100) : 0;
              const colorClass = pct >= 70 ? "text-emerald-600" : pct >= 40 ? "text-amber-600" : "text-red-600";
              const barColor = pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500";
              return (
                <tr key={row.angkatan} className="hover:bg-gray-50/50">
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#0B27BC]/10 text-[#0B27BC] text-xs font-medium">
                      {row.angkatan}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center text-muted-foreground">{row.total}</td>
                  <td className="px-3 py-2 text-center font-semibold">{row.vote}</td>
                  <td className={`px-3 py-2 text-center font-bold ${colorClass}`}>{pct}%</td>
                  <td className="px-3 py-2">
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${barColor} transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
