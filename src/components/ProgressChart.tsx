"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import { formatNum } from "@/lib/format";

interface ProgressChartProps {
  stats: {
    total: number;
    dptSudah: number;
    kontakSudah: number;
    grupSudah: number;
    voteSudah: number;
  };
}

const COLORS = {
  sudah: "#0B27BC",
  belum: "#eef1f8",
};

export function ProgressChart({ stats }: ProgressChartProps) {
  const categories = [
    { name: "Status DPT", sudah: stats.dptSudah, belum: stats.total - stats.dptSudah },
    { name: "Dikontak", sudah: stats.kontakSudah, belum: stats.total - stats.kontakSudah },
    { name: "Masuk Grup", sudah: stats.grupSudah, belum: stats.total - stats.grupSudah },
    { name: "Vote", sudah: stats.voteSudah, belum: stats.total - stats.voteSudah },
  ];

  return (
    <div className="bg-white rounded-xl border border-border p-4 shadow-sm">
      <h3 className="font-semibold text-foreground mb-4">Progress Keseluruhan</h3>
      <div className="grid grid-cols-2 gap-4">
        {categories.map((cat) => {
          const data = [
            { name: "Sudah", value: cat.sudah },
            { name: "Belum", value: cat.belum },
          ];
          const pct = stats.total > 0 ? Math.round((cat.sudah / stats.total) * 100) : 0;

          return (
            <div key={cat.name} className="flex flex-col items-center">
              <p className="text-xs font-medium text-muted-foreground mb-1">{cat.name}</p>
              <div className="w-full h-[120px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data}
                      cx="50%"
                      cy="50%"
                      innerRadius={30}
                      outerRadius={45}
                      dataKey="value"
                      startAngle={90}
                      endAngle={-270}
                      strokeWidth={0}
                    >
                      {data.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={index === 0 ? COLORS.sudah : COLORS.belum}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => [formatNum(Number(value)), ""]}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <p className="text-lg font-bold text-foreground">{pct}%</p>
              <p className="text-xs text-muted-foreground">{formatNum(cat.sudah)}/{formatNum(stats.total)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
