"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { formatNum } from "@/lib/format";

interface AngkatanData {
  angkatan: string;
  angkatanNum: number;
  total: number;
  dpt: number;
  kontak: number;
  grup: number;
  vote: number;
  alumni: number;
}

interface AngkatanChartProps {
  data: AngkatanData[];
}

export function AngkatanChart({ data }: AngkatanChartProps) {
  return (
    <div className="bg-white rounded-xl border border-border p-4 shadow-sm">
      <h3 className="font-semibold text-foreground mb-4">Data per Angkatan</h3>
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="angkatan"
              tick={{ fontSize: 10 }}
              interval={0}
              angle={-45}
              textAnchor="end"
              height={50}
            />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(value) => [formatNum(Number(value)), ""]}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="alumni" name="Alumni" fill="#84303F" radius={[2, 2, 0, 0]} />
            <Bar dataKey="total" name="Anggota" fill="#0B27BC" radius={[2, 2, 0, 0]} />
            <Bar dataKey="vote" name="Vote" fill="#FE8DA1" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
