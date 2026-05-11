"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, History, Trash2, LogOut, Menu, X,
  Settings, ChevronRight, Bell
} from "lucide-react";
import { onAuthChange, logoutAdmin, getAdminProfile } from "@/services/auth.service";
import { AdminUser } from "@/types/user";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/bins", label: "Kelola Bin", icon: Trash2 },
  { href: "/history", label: "Riwayat", icon: History },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const unsub = onAuthChange(async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }
      const profile = await getAdminProfile(user.uid);
      setAdmin(profile);
      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  const handleLogout = async () => {
    await logoutAdmin();
    router.replace("/login");
  };

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center animate-glow"
            style={{ background: "var(--brand-dim)", border: "1px solid var(--border-strong)" }}>
            <Trash2 size={20} style={{ color: "var(--brand)" }} />
          </div>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Memuat...</p>
        </div>
      </div>
    );
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: "var(--brand-dim)", border: "1px solid var(--border-strong)" }}>
          <Trash2 size={16} style={{ color: "var(--brand)" }} />
        </div>
        <div>
          <div className="font-display font-bold text-sm" style={{ color: "var(--text-primary)" }}>HolyBin</div>
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>Admin Panel</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5">
        <p className="px-3 pb-2 pt-1 text-xs font-medium uppercase tracking-widest" style={{ color: "var(--text-ghost)" }}>
          Menu
        </p>
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setSidebarOpen(false)}
              className={`nav-item ${isActive ? "active" : ""}`}>
              <Icon size={16} />
              {label}
              {isActive && <ChevronRight size={14} className="ml-auto" />}
            </Link>
          );
        })}
      </nav>

      {/* Admin profile */}
      <div className="p-3 border-t" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "var(--bg-elevated)" }}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ background: "var(--brand-dim)", color: "var(--brand)", border: "1px solid var(--border-strong)" }}>
            {admin?.displayName?.charAt(0).toUpperCase() || "A"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
              {admin?.displayName || "Admin"}
            </div>
            <div className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
              {admin?.email}
            </div>
          </div>
          <button onClick={handleLogout} className="btn-ghost p-1.5" title="Logout"
            style={{ padding: "0.375rem" }}>
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-dvh">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-60 border-r fixed top-0 left-0 h-full z-30"
        style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)} />
          <aside className="relative z-10 w-64 flex flex-col h-full"
            style={{ background: "var(--bg-card)", borderRight: "1px solid var(--border)" }}>
            <button onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 btn-ghost p-2">
              <X size={18} />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 lg:ml-60 flex flex-col min-h-dvh">
        {/* Top bar (mobile) */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 border-b sticky top-0 z-20"
          style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
          <button onClick={() => setSidebarOpen(true)} className="btn-ghost p-2">
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <Trash2 size={16} style={{ color: "var(--brand)" }} />
            <span className="font-display font-bold" style={{ color: "var(--text-primary)" }}>HolyBin</span>
          </div>
          <button onClick={handleLogout} className="btn-ghost p-2">
            <LogOut size={18} />
          </button>
        </header>

        <main className="flex-1 p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
