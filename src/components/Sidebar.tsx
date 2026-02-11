"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  LayoutDashboard,
  Calendar,
  UserCheck,
  Users,
  Trophy,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { useRole } from "@/lib/RoleContext";
import { supabase } from "@/lib/supabase";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/", minRole: "viewer" as const },
  { icon: Calendar, label: "Kegiatan", path: "/kegiatan", minRole: "viewer" as const },
  { icon: UserCheck, label: "Check-in", path: "/checkin", minRole: "koordinator" as const },
  { icon: Users, label: "Anggota", path: "/anggota", minRole: "viewer" as const },
  { icon: Trophy, label: "Leaderboard", path: "/leaderboard", minRole: "viewer" as const },
];

const adminItems = [
  { icon: Settings, label: "Admin", path: "/admin/users", minRole: "admin" as const },
];

export function Sidebar() {
  const pathname = usePathname();
  const { role, userEmail, canManageUsers } = useRole();
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/";
    return pathname.startsWith(path);
  };

  const canSee = (minRole: "viewer" | "koordinator" | "admin") => {
    if (minRole === "viewer") return true;
    if (minRole === "koordinator") return role === "admin" || role === "koordinator";
    if (minRole === "admin") return role === "admin";
    return false;
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <aside
      className={`hidden md:flex flex-col bg-white border-r border-border h-screen sticky top-0 transition-all duration-300 ${
        collapsed ? "w-[64px]" : "w-[240px]"
      }`}
    >
      {/* Logo */}
      <div className="p-4 border-b border-border flex items-center gap-3">
        <Image
          src="/images/logo-dark.png"
          alt="IKASTARA KITA"
          width={collapsed ? 32 : 120}
          height={collapsed ? 11 : 40}
          className="rounded"
        />
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-3 px-2 space-y-1">
        {navItems.filter((item) => canSee(item.minRole)).map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-[#0B27BC] text-white"
                  : "text-gray-600 hover:bg-gray-100 hover:text-foreground"
              }`}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="w-5 h-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}

        {/* Admin section */}
        {canManageUsers && (
          <>
            <div className={`my-2 border-t border-border ${collapsed ? "mx-1" : "mx-3"}`} />
            {adminItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? "bg-[#0B27BC] text-white"
                      : "text-gray-600 hover:bg-gray-100 hover:text-foreground"
                  }`}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-border p-3 space-y-2">
        {!collapsed && (
          <div className="px-2">
            <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
            <p className="text-xs font-medium text-[#0B27BC] capitalize">{role}</p>
          </div>
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors flex-1"
            title="Logout"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronLeft className="w-4 h-4 text-gray-400" />
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}
