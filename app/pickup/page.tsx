"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Trash2, ArrowLeft, CheckCircle2, AlertCircle, ChevronRight,
  User, Phone, MapPin, FileText, Weight, Loader2
} from "lucide-react";
import { verifyCode, confirmPickup, getTrashBinById, getLatestActiveCodeForBin } from "@/services/pickup.service";
import { UniqueCode } from "@/types/pickup";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { useEffect } from "react";

type Step = "input" | "confirm" | "success";

export default function PickupPage() {
  const [step, setStep] = useState<Step>("input");
  const [codeInput, setCodeInput] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const [verifiedCode, setVerifiedCode] = useState<UniqueCode | null>(null);

  // Officer form
  const [officerName, setOfficerName] = useState("");
  const [officerPhone, setOfficerPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [weight, setWeight] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState("");

  // Auto-verify code from URL param
  const autoVerifyCode = async (code: string) => {
    setVerifying(true);
    setVerifyError("");
    try {
      const result = await verifyCode(code);
      if (result.valid && result.codeData) {
        setVerifiedCode(result.codeData);
        setStep("confirm");
      } else {
        setVerifyError(result.error || "Kode tidak valid.");
      }
    } catch {
      setVerifyError("Terjadi kesalahan saat memverifikasi kode otomatis.");
    } finally {
      setVerifying(false);
    }
  };

  // Handle direct bin QR scan (static)
  const handleBinScan = async (binId: string) => {
    setVerifying(true);
    setVerifyError("");
    try {
      const bin = await getTrashBinById(binId);
      if (bin) {
        // Coba cari kode harian aktif (pending) untuk bin ini dari Firebase
        const activeCode = await getLatestActiveCodeForBin(bin.id);

        if (activeCode) {
          // Jika ada kode pending harian, gunakan kode tersebut (akan ter-update menjadi completed saat konfirmasi)
          setVerifiedCode(activeCode);
        } else {
          // Jika tidak ada, gunakan fallback scan statis agar petugas tidak terhambat
          setVerifiedCode({
            id: "STATIC_QR",
            code: "QR-SCAN",
            binId: bin.id,
            binLocation: bin.location,
            expiresAt: new Date(Date.now() + 3600000).toISOString(),
            status: "pending",
            generatedAt: new Date().toISOString()
          });
        }
        setStep("confirm");
      } else {
        setVerifyError("Lokasi tempat sampah tidak aktif atau tidak ditemukan.");
      }
    } catch (err) {
      console.error(err);
      setVerifyError("Gagal mengambil detail lokasi tempat sampah.");
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const codeParam = params.get("code");
      const binIdParam = params.get("binId");

      if (codeParam) {
        setCodeInput(codeParam.toUpperCase());
        autoVerifyCode(codeParam);
      } else if (binIdParam) {
        handleBinScan(binIdParam);
      }

      // Load saved officer info
      const savedName = localStorage.getItem("officer_name");
      const savedPhone = localStorage.getItem("officer_phone");
      if (savedName) setOfficerName(savedName);
      if (savedPhone) setOfficerPhone(savedPhone);
    }
  }, []);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codeInput.trim()) {
      setVerifyError("Masukkan kode terlebih dahulu.");
      return;
    }
    setVerifying(true);
    setVerifyError("");
    try {
      const result = await verifyCode(codeInput.trim());
      if (result.valid && result.codeData) {
        setVerifiedCode(result.codeData);
        setStep("confirm");
      } else {
        setVerifyError(result.error || "Kode tidak valid.");
      }
    } catch {
      setVerifyError("Terjadi kesalahan. Periksa koneksi Anda.");
    } finally {
      setVerifying(false);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!officerName.trim()) {
      setConfirmError("Nama petugas wajib diisi.");
      return;
    }
    if (!verifiedCode) return;

    setConfirming(true);
    setConfirmError("");
    try {
      await confirmPickup(
        verifiedCode.id,
        officerName.trim(),
        officerPhone.trim(),
        verifiedCode.binId,
        verifiedCode.binLocation,
        verifiedCode.code,
        notes.trim() || undefined,
        weight ? parseFloat(weight) : undefined
      );

      // Save officer info to localStorage for future automatic check-ins
      if (typeof window !== "undefined") {
        localStorage.setItem("officer_name", officerName.trim());
        localStorage.setItem("officer_phone", officerPhone.trim());
      }

      setStep("success");
    } catch {
      setConfirmError("Gagal konfirmasi. Coba lagi.");
    } finally {
      setConfirming(false);
    }
  };

  const reset = () => {
    setStep("input");
    setCodeInput("");
    setVerifyError("");
    setVerifiedCode(null);
    setOfficerName("");
    setOfficerPhone("");
    setNotes("");
    setWeight("");
    setConfirmError("");
  };

  return (
    <main className="min-h-dvh flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-5 py-4 border-b"
        style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}>
        <Link href="/" className="flex items-center gap-2" style={{ textDecoration: "none" }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "var(--brand-dim)", border: "1px solid var(--border-strong)" }}>
            <Trash2 size={15} style={{ color: "var(--brand)" }} />
          </div>
          <span className="font-display font-bold" style={{ color: "var(--text-primary)" }}>HolyBin</span>
        </Link>
        <Link href="/login" className="btn-ghost text-sm">
          Admin →
        </Link>
      </nav>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-5">
        <div className="w-full max-w-md">

          {/* Step indicators */}
          <div className="flex items-center gap-2 mb-8 justify-center">
            {(["input", "confirm", "success"] as Step[]).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all`}
                  style={{
                    background: step === s ? "var(--brand)" : i < (["input","confirm","success"].indexOf(step)) ? "var(--brand-dim)" : "var(--bg-elevated)",
                    color: step === s ? "#052e16" : i < (["input","confirm","success"].indexOf(step)) ? "var(--brand)" : "var(--text-ghost)",
                    border: `1px solid ${step === s ? "var(--brand)" : i < (["input","confirm","success"].indexOf(step)) ? "var(--border-strong)" : "var(--border)"}`,
                  }}>
                  {i < (["input","confirm","success"].indexOf(step)) ? "✓" : i + 1}
                </div>
                {i < 2 && <div className="w-8 h-px" style={{ background: "var(--border)" }} />}
              </div>
            ))}
          </div>

          {/* ── STEP 1: Input Code ── */}
          {step === "input" && (
            <div className="animate-enter">
              <div className="text-center mb-8">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-glow"
                  style={{ background: "var(--brand-dim)", border: "1px solid var(--border-strong)" }}>
                  <Trash2 size={26} style={{ color: "var(--brand)" }} />
                </div>
                <h1 className="font-display font-bold text-2xl mb-2" style={{ color: "var(--text-primary)" }}>
                  Input Kode Pengambilan
                </h1>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  Masukkan kode unik yang diberikan oleh admin
                </p>
              </div>

              <div className="glass-card p-6">
                <form onSubmit={handleVerify} className="space-y-4">
                  {verifyError && (
                    <div className="flex items-center gap-2 p-3 rounded-lg text-sm animate-enter"
                      style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444" }}>
                      <AlertCircle size={14} className="flex-shrink-0" />
                      {verifyError}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
                      Kode Unik
                    </label>
                    <input
                      className="input-base font-mono text-center text-xl tracking-widest"
                      placeholder="TRH-XXXX"
                      value={codeInput}
                      onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                      maxLength={8}
                      autoCapitalize="characters"
                      autoCorrect="off"
                      spellCheck={false}
                      style={{ fontSize: "1.25rem", letterSpacing: "0.1em", padding: "0.875rem" }}
                    />
                    <p className="text-xs mt-1.5 text-center" style={{ color: "var(--text-ghost)" }}>
                      Format: TRH-XXXX
                    </p>
                  </div>

                  <button type="submit" disabled={verifying || !codeInput.trim()}
                    className="btn-primary w-full justify-center py-3">
                    {verifying ? (
                      <><Loader2 size={16} className="animate-spin" /> Memverifikasi...</>
                    ) : (
                      <>Verifikasi Kode <ChevronRight size={16} /></>
                    )}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* ── STEP 2: Confirm ── */}
          {step === "confirm" && verifiedCode && (
            <div className="animate-enter">
              <div className="text-center mb-6">
                <h1 className="font-display font-bold text-2xl mb-1" style={{ color: "var(--text-primary)" }}>
                  Konfirmasi Pengambilan
                </h1>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  Lengkapi data sebelum konfirmasi
                </p>
              </div>

              {/* Code info card */}
              <div className="p-4 rounded-xl mb-5"
                style={{ background: "var(--brand-dim)", border: "1px solid var(--border-strong)" }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium" style={{ color: "var(--brand)" }}>Kode Terverifikasi</span>
                  <span className="badge badge-completed">Valid</span>
                </div>
                <div className="font-mono font-medium text-xl tracking-widest mb-2" style={{ color: "var(--brand)" }}>
                  {verifiedCode.code}
                </div>
                <div className="flex items-center gap-1.5 text-sm" style={{ color: "var(--text-secondary)" }}>
                  <MapPin size={13} />
                  {verifiedCode.binLocation}
                </div>
                <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                  Berlaku hingga {format(new Date(verifiedCode.expiresAt), "HH:mm, d MMMM yyyy", { locale: idLocale })}
                </div>
              </div>

              <div className="glass-card p-6">
                <form onSubmit={handleConfirm} className="space-y-4">
                  {confirmError && (
                    <div className="flex items-center gap-2 p-3 rounded-lg text-sm animate-enter"
                      style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444" }}>
                      <AlertCircle size={14} /> {confirmError}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                      <User size={13} className="inline mr-1" />Nama Petugas *
                    </label>
                    <input className="input-base" placeholder="Nama lengkap petugas"
                      value={officerName} onChange={(e) => setOfficerName(e.target.value)} required />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                      <Phone size={13} className="inline mr-1" />No. Telepon
                    </label>
                    <input className="input-base" placeholder="08xx-xxxx-xxxx" type="tel"
                      value={officerPhone} onChange={(e) => setOfficerPhone(e.target.value)} />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                        <Weight size={13} className="inline mr-1" />Berat (kg)
                      </label>
                      <input className="input-base" placeholder="0.0" type="number" step="0.1" min="0"
                        value={weight} onChange={(e) => setWeight(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                        <FileText size={13} className="inline mr-1" />Catatan
                      </label>
                      <input className="input-base" placeholder="Opsional"
                        value={notes} onChange={(e) => setNotes(e.target.value)} />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-1">
                    <button type="button" onClick={() => setStep("input")} className="btn-secondary flex-1 justify-center">
                      <ArrowLeft size={15} /> Kembali
                    </button>
                    <button type="submit" disabled={confirming} className="btn-primary flex-1 justify-center">
                      {confirming ? (
                        <><Loader2 size={15} className="animate-spin" /> Menyimpan...</>
                      ) : (
                        <><CheckCircle2 size={15} /> Konfirmasi</>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ── STEP 3: Success ── */}
          {step === "success" && (
            <div className="animate-enter text-center">
              <div className="glass-card p-10">
                <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 animate-glow"
                  style={{ background: "var(--brand-dim)", border: "2px solid var(--brand)" }}>
                  <CheckCircle2 size={40} style={{ color: "var(--brand)" }} />
                </div>
                <h2 className="font-display font-bold text-2xl mb-3" style={{ color: "var(--text-primary)" }}>
                  Pengambilan Berhasil!
                </h2>
                <p className="text-sm mb-2" style={{ color: "var(--text-muted)" }}>
                  Data pengambilan sampah telah tersimpan.
                </p>
                <div className="font-mono text-sm mb-8 py-2 px-4 rounded-lg inline-block"
                  style={{ background: "var(--brand-dim)", color: "var(--brand)", border: "1px solid var(--border-strong)" }}>
                  {verifiedCode?.code}
                </div>
                <div className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>
                  📍 {verifiedCode?.binLocation}
                </div>
                <div className="flex flex-col gap-3">
                  <button onClick={reset} className="btn-primary w-full justify-center py-3">
                    Pengambilan Baru
                  </button>
                  <Link href="/" className="btn-ghost w-full justify-center">
                    Kembali ke Beranda
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
