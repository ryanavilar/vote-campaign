"use client";

import { Sidebar } from "@/components/Sidebar";
import { BottomNav } from "@/components/BottomNav";
import { RoleProvider } from "@/lib/RoleContext";
import { ToastProvider } from "@/components/Toast";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RoleProvider>
      <ToastProvider>
        <div className="flex min-h-screen bg-background">
          <Sidebar />
          <main className="flex-1 min-w-0 pb-20 md:pb-0">
            {children}
          </main>
          <BottomNav />
        </div>
      </ToastProvider>
    </RoleProvider>
  );
}
