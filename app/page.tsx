"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Trash2, ShieldCheck, ArrowRight, Zap, BarChart3, Clock } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-dvh flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--brand-dim)", border: "1px solid var(--border-strong)" }}>
            <Trash2 size={16} style={{ color: "var(--brand)" }} />
          </div>
          <span className="font-display font-bold text-lg" style={{ color: "var(--text-primary)" }}>
            HolyBin
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/pickup" className="btn-ghost text-sm">
            Saya Petugas
          </Link>
          <Link href="/login" className="btn-primary text-sm">
            Login Admin
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center">
        <div className="max-w-2xl mx-auto animate-enter">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 mb-8 px-4 py-1.5 rounded-full text-sm font-medium"
            style={{ background: "var(--brand-dim)", border: "1px solid var(--border-strong)", color: "var(--brand)" }}>
            <Zap size={13} />
            Sistem Manajemen Sampah Cerdas
          </div>

          <h1 className="font-display font-bold mb-6 leading-tight" style={{ fontSize: "clamp(2.5rem, 5vw, 4rem)", color: "var(--text-primary)" }}>
            Kelola Pengambilan{" "}
            <span style={{ color: "var(--brand)" }}>Sampah</span>{" "}
            Lebih Efisien
          </h1>

          <p className="text-lg mb-10" style={{ color: "var(--text-muted)", lineHeight: 1.7 }}>
            Sistem berbasis kode unik untuk memvalidasi petugas pengambil sampah.
            Admin dapat memonitor semua aktivitas pengambilan secara real-time.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/pickup" className="btn-primary text-base px-8 py-3">
              Input Kode Pengambilan
              <ArrowRight size={18} />
            </Link>
            <Link href="/login" className="btn-secondary text-base px-8 py-3">
              <ShieldCheck size={18} />
              Portal Admin
            </Link>
          </div>
        </div>

        {/* Feature cards */}
        <div className="mt-20 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl w-full">
          {[
            {
              icon: <Zap size={20} style={{ color: "var(--brand)" }} />,
              title: "Kode Unik",
              desc: "Generate kode sekali pakai untuk setiap sesi pengambilan sampah.",
            },
            {
              icon: <BarChart3 size={20} style={{ color: "var(--brand)" }} />,
              title: "Dashboard Real-time",
              desc: "Pantau semua aktivitas pengambilan dari satu dashboard terpusat.",
            },
            {
              icon: <Clock size={20} style={{ color: "var(--brand)" }} />,
              title: "Riwayat Lengkap",
              desc: "Akses riwayat pengambilan kapan saja untuk audit dan pelaporan.",
            },
          ].map((f, i) => (
            <div key={i} className="stat-card text-left" style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
                style={{ background: "var(--brand-dim)", border: "1px solid var(--border)" }}>
                {f.icon}
              </div>
              <h3 className="font-display font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                {f.title}
              </h3>
              <p className="text-sm" style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center py-6 text-sm border-t" style={{ borderColor: "var(--border)", color: "var(--text-ghost)" }}>
        © {new Date().getFullYear()} HolyBin · Smart Waste Management System
      </footer>
    </main>
  );
}
