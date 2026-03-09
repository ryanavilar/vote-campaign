"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Calendar,
  Trophy,
  MessageSquare,
  Crosshair,
  GraduationCap,
  UserPlus,
  MoreHorizontal,
  LogOut,
  Settings,
  Smartphone,
  Bot,
  Settings2,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import { useRole } from "@/lib/RoleContext";
import { getRoleDisplayName } from "@/lib/roles";
import { supabase } from "@/lib/supabase";

interface BottomNavItem {
  icon: typeof LayoutDashboard;
  label: string;
  path: string;
  minRole?: "campaigner" | "admin" | "super_admin";
  hideForRole?: "campaigner" | "admin";
}

const navItems: BottomNavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/", hideForRole: "campaigner" },
  { icon: GraduationCap, label: "Alumni", path: "/admin/alumni", minRole: "admin" },
  { icon: Crosshair, label: "Target", path: "/target", minRole: "campaigner", hideForRole: "admin" },
  { icon: UserPlus, label: "Penugasan", path: "/admin/assignments", minRole: "admin" },
  { icon: Calendar, label: "Kegiatan", path: "/kegiatan", hideForRole: "campaigner" },
  { icon: Trophy, label: "Leaderboard", path: "/leaderboard", hideForRole: "campaigner" },
  { icon: MessageSquare, label: "Harapan", path: "/harapan", hideForRole: "campaigner" },
];

const moreItems: BottomNavItem[] = [
  { icon: Smartphone, label: "WA Group", path: "/wa-group", minRole: "admin" },
  { icon: Settings, label: "Pengguna", path: "/admin/users", minRole: "admin" },
  { icon: Users, label: "Anggota", path: "/anggota", minRole: "super_admin" },
  { icon: Bot, label: "Mimin.io", path: "/admin/mimin", minRole: "super_admin" },
  { icon: Settings2, label: "Pengaturan", path: "/admin/settings", minRole: "super_admin" },
];

export function BottomNav() {
  const pathname = usePathname();
  const { role, userEmail, userName } = useRole();
  const [showMore, setShowMore] = useState(false);

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/";
    return pathname.startsWith(path);
  };

  const canSee = (item: BottomNavItem) => {
    if (item.hideForRole === "campaigner" && role === "campaigner") return false;
    if (item.hideForRole === "admin" && (role === "admin" || role === "super_admin")) return false;
    if (!item.minRole) return true;
    if (item.minRole === "campaigner") return role === "super_admin" || role === "admin" || role === "campaigner";
    if (item.minRole === "admin") return role === "super_admin" || role === "admin";
    if (item.minRole === "super_admin") return role === "super_admin";
    return false;
  };

  const visibleItems = navItems.filter((item) => canSee(item));
  const visibleMoreItems = moreItems.filter((item) => canSee(item));
  const isMoreActive = moreItems.some((item) => canSee(item) && isActive(item.path));

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <>
      {/* More panel overlay */}
      {showMore && (
        <div className="md:hidden fixed inset-0 z-50" onClick={() => setShowMore(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div
            className="absolute bottom-[4.5rem] left-0 right-0 bg-white rounded-t-2xl shadow-xl border-t border-border p-4 space-y-1 safe-area-bottom animate-in slide-in-from-bottom-4 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-border">
              <div>
                {userName && <p className="text-xs font-semibold text-foreground truncate max-w-[200px]">{userName}</p>}
                <p className="text-xs text-muted-foreground truncate max-w-[200px]">{userEmail}</p>
                <p className="text-xs font-semibold text-[#0B27BC]">{getRoleDisplayName(role)}</p>
              </div>
              <button onClick={() => setShowMore(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            {visibleMoreItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={() => setShowMore(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? "bg-[#0B27BC]/10 text-[#0B27BC]"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}

            <div className="pt-2 mt-2 border-t border-border">
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors w-full"
              >
                <LogOut className="w-5 h-5" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom nav bar */}
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
          {/* More button */}
          <button
            onClick={() => setShowMore(!showMore)}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full relative ${
              showMore || isMoreActive ? "text-[#0B27BC]" : "text-gray-400"
            }`}
          >
            {isMoreActive && !showMore && (
              <div className="absolute top-0 left-1/4 right-1/4 h-0.5 bg-[#FE8DA1] rounded-full" />
            )}
            <MoreHorizontal className="w-5 h-5" />
            <span className="text-[10px] font-medium">Lainnya</span>
          </button>
        </div>
      </nav>
    </>
  );
}
