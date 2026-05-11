"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Trash2, ShieldCheck, AlertCircle, ArrowLeft } from "lucide-react";
import { loginAdmin } from "@/services/auth.service";
import { onAuthChange } from "@/services/auth.service";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsub = onAuthChange((user) => {
      if (user) router.replace("/dashboard");
    });
    return () => unsub();
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Email dan password wajib diisi.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await loginAdmin(email, password);
      router.push("/dashboard");
    } catch (err: any) {
      const msg = err.code === "auth/invalid-credential"
        ? "Email atau password salah."
        : err.code === "auth/too-many-requests"
        ? "Terlalu banyak percobaan. Coba lagi nanti."
        : "Gagal login. Periksa koneksi Anda.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-dvh flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex flex-col justify-between w-96 p-10 border-r relative overflow-hidden"
        style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}>

        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 70% 60% at 30% 80%, rgba(34,197,94,0.08) 0%, transparent 70%)" }} />

        <div className="relative">
          <Link href="/" className="flex items-center gap-2 mb-12" style={{ textDecoration: "none" }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "var(--brand-dim)", border: "1px solid var(--border-strong)" }}>
              <Trash2 size={18} style={{ color: "var(--brand)" }} />
            </div>
            <span className="font-display font-bold text-xl" style={{ color: "var(--text-primary)" }}>HolyBin</span>
          </Link>

          <div className="space-y-6">
            <div>
              <h2 className="font-display font-bold text-3xl mb-3" style={{ color: "var(--text-primary)" }}>
                Portal Admin
              </h2>
              <p style={{ color: "var(--text-muted)", lineHeight: 1.7, fontSize: "0.9rem" }}>
                Kelola seluruh operasi pengambilan sampah dari satu dashboard terpusat.
              </p>
            </div>

            {[
              "Generate kode unik untuk petugas",
              "Monitor pengambilan real-time",
              "Akses riwayat & laporan lengkap",
              "Kelola data bin dan petugas",
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: "var(--brand-dim)", border: "1px solid var(--border-strong)" }}>
                  <div className="w-2 h-2 rounded-full" style={{ background: "var(--brand)" }} />
                </div>
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{f}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative text-xs" style={{ color: "var(--text-ghost)" }}>
          © {new Date().getFullYear()} HolyBin System
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm animate-enter">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "var(--brand-dim)", border: "1px solid var(--border-strong)" }}>
              <Trash2 size={16} style={{ color: "var(--brand)" }} />
            </div>
            <span className="font-display font-bold text-lg" style={{ color: "var(--text-primary)" }}>HolyBin</span>
          </div>

          <div className="mb-8">
            <h1 className="font-display font-bold text-2xl mb-2" style={{ color: "var(--text-primary)" }}>
              Masuk ke Dashboard
            </h1>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Khusus untuk admin sistem.{" "}
              <Link href="/pickup" style={{ color: "var(--brand)", textDecoration: "none" }}>
                Saya petugas →
              </Link>
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Error alert */}
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg text-sm animate-enter"
                style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444" }}>
                <AlertCircle size={15} className="flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Email */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                Email Admin
              </label>
              <input
                type="email"
                className="input-base"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="input-base pr-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn-primary w-full justify-center py-3 mt-2" disabled={loading}>
              {loading ? (
                <>
                  <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  Memverifikasi...
                </>
              ) : (
                <>
                  <ShieldCheck size={16} />
                  Masuk
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t text-center" style={{ borderColor: "var(--border)" }}>
            <Link href="/" className="inline-flex items-center gap-1.5 text-sm btn-ghost">
              <ArrowLeft size={14} />
              Kembali ke Beranda
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
