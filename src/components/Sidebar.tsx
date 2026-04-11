"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  LayoutDashboard,
  Calendar,
  Users,
  Trophy,
  MessageSquare,
  Settings,
  Settings2,
  UserPlus,
  GraduationCap,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Crosshair,
  Smartphone,
  Bot,
  ClipboardList,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useRole } from "@/lib/RoleContext";
import { getRoleDisplayName } from "@/lib/roles";
import { supabase } from "@/lib/supabase";

interface NavItem {
  icon: typeof LayoutDashboard;
  label: string;
  path: string;
  minRole: "viewer" | "campaigner" | "admin" | "super_admin";
  hideForRole?: "campaigner" | "admin";
}

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/", minRole: "viewer", hideForRole: "campaigner" },
  { icon: GraduationCap, label: "Alumni", path: "/admin/alumni", minRole: "admin" },
  { icon: Crosshair, label: "Target Saya", path: "/target", minRole: "campaigner", hideForRole: "admin" },
  { icon: UserPlus, label: "Penugasan", path: "/admin/assignments", minRole: "admin" },
  { icon: Calendar, label: "Kegiatan", path: "/kegiatan", minRole: "viewer", hideForRole: "campaigner" },
  { icon: Users, label: "Anggota", path: "/anggota", minRole: "super_admin" },
  { icon: Smartphone, label: "WA Group", path: "/wa-group", minRole: "admin" },
  { icon: Trophy, label: "Leaderboard", path: "/leaderboard", minRole: "viewer", hideForRole: "campaigner" },
  { icon: MessageSquare, label: "Harapan", path: "/harapan", minRole: "viewer", hideForRole: "campaigner" },
  { icon: ClipboardList, label: "Log Form", path: "/form-log", minRole: "admin" },
];

const adminItems: NavItem[] = [
  { icon: Settings, label: "Pengguna", path: "/admin/users", minRole: "admin" },
  { icon: Bot, label: "Mimin.io", path: "/admin/mimin", minRole: "super_admin" },
  { icon: Settings2, label: "Pengaturan", path: "/admin/settings", minRole: "super_admin" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { role, userEmail, userName, canManageUsers } = useRole();
  const [collapsed, setCollapsed] = useState(false);

  // Persist collapsed state
  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved === "true") setCollapsed(true);
  }, []);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("sidebar-collapsed", String(next));
  };

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/";
    return pathname.startsWith(path);
  };

  const canSee = (item: NavItem) => {
    const { minRole, hideForRole } = item;
    if (hideForRole === "campaigner" && role === "campaigner") return false;
    if (hideForRole === "admin" && (role === "admin" || role === "super_admin")) return false;
    if (minRole === "viewer") return true;
    if (minRole === "campaigner") return role === "super_admin" || role === "admin" || role === "campaigner";
    if (minRole === "admin") return role === "super_admin" || role === "admin";
    if (minRole === "super_admin") return role === "super_admin";
    return false;
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <aside
      className={`hidden md:flex flex-col bg-white border-r border-border h-screen sticky top-0 transition-all duration-200 ease-out ${
        collapsed ? "w-[60px]" : "w-[220px]"
      }`}
    >
      {/* Logo + toggle */}
      <div className="p-3 border-b border-border flex items-center justify-between gap-2">
        {!collapsed && (
          <Image
            src="/images/logo-dark.png"
            alt="IKASTARA KITA"
            width={100}
            height={34}
            className="rounded"
          />
        )}
        <button
          onClick={toggleCollapsed}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors shrink-0"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <PanelLeftOpen className="w-4 h-4 text-gray-400" />
          ) : (
            <PanelLeftClose className="w-4 h-4 text-gray-400" />
          )}
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-2 px-1.5 space-y-0.5 overflow-y-auto">
        {navItems.filter((item) => canSee(item)).map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                active
                  ? "bg-[#0B27BC] text-white shadow-sm"
                  : "text-gray-500 hover:bg-gray-50 hover:text-foreground"
              } ${collapsed ? "justify-center" : ""}`}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="w-[18px] h-[18px] shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}

        {/* Admin section */}
        {canManageUsers && (
          <>
            <div className={`my-1.5 border-t border-border ${collapsed ? "mx-1" : "mx-2"}`} />
            {adminItems.filter((item) => canSee(item)).map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                    active
                      ? "bg-[#0B27BC] text-white shadow-sm"
                      : "text-gray-500 hover:bg-gray-50 hover:text-foreground"
                  } ${collapsed ? "justify-center" : ""}`}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className="w-[18px] h-[18px] shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-border p-2">
        {!collapsed && (
          <div className="px-2 pb-2">
            <p className="text-xs font-medium text-foreground truncate">{userName || userEmail}</p>
            <p className="text-[11px] text-muted-foreground truncate">{userEmail}</p>
            <p className="text-[11px] font-semibold text-[#0B27BC]">{getRoleDisplayName(role)}</p>
          </div>
        )}
        <button
          onClick={handleLogout}
          className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors w-full ${
            collapsed ? "justify-center" : ""
          }`}
          title="Logout"
        >
          <LogOut className="w-[18px] h-[18px] shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}
