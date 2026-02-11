"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, Calendar, UserCheck, Users, Trophy } from "lucide-react";
import { useRole } from "@/lib/RoleContext";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: Calendar, label: "Kegiatan", path: "/kegiatan" },
  { icon: UserCheck, label: "Check-in", path: "/checkin", minRole: "koordinator" as const },
  { icon: Users, label: "Anggota", path: "/anggota" },
  { icon: Trophy, label: "Leaderboard", path: "/leaderboard" },
];

export function BottomNav() {
  const pathname = usePathname();
  const { role } = useRole();

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/";
    return pathname.startsWith(path);
  };

  const canSee = (minRole?: "koordinator" | "admin") => {
    if (!minRole) return true;
    if (minRole === "koordinator") return role === "admin" || role === "koordinator";
    if (minRole === "admin") return role === "admin";
    return false;
  };

  const visibleItems = navItems.filter((item) => canSee(item.minRole));

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-border z-50 safe-area-bottom">
      <div className="flex items-center justify-around h-16">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full relative ${
                active ? "text-[#0B27BC]" : "text-gray-400"
              }`}
            >
              {active && (
                <div className="absolute top-0 left-1/4 right-1/4 h-0.5 bg-[#FE8DA1] rounded-full" />
              )}
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
