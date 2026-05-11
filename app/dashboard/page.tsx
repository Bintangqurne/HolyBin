"use client";

import { useEffect, useState } from "react";
import {
  BarChart3, Trash2, Clock, CheckCircle2, Plus, Copy, RefreshCw,
  Zap, AlertTriangle, Check, ChevronRight, Calendar
} from "lucide-react";
import {
  generateCode, getDashboardStats, getAllCodes, getTrashBins,
} from "@/services/pickup.service";
import { UniqueCode, TrashBin } from "@/types/pickup";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

interface Stats {
  totalPickups: number;
  todayPickups: number;
  activeCodes: number;
  totalBins: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentCodes, setRecentCodes] = useState<UniqueCode[]>([]);
  const [bins, setBins] = useState<TrashBin[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedBin, setSelectedBin] = useState("");
  const [hoursValid, setHoursValid] = useState(24);
  const [lastGenerated, setLastGenerated] = useState<UniqueCode | null>(null);
  const [copied, setCopied] = useState(false);

  const loadData = async () => {
    try {
      const [statsData, codes, binsData] = await Promise.all([
        getDashboardStats(),
        getAllCodes(),
        getTrashBins(),
      ]);
      setStats(statsData);
      setRecentCodes(codes.slice(0, 10));
      setBins(binsData);
      if (binsData.length > 0 && !selectedBin) {
        setSelectedBin(binsData[0].id);
      }
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleGenerate = async () => {
    if (!selectedBin) return;
    const bin = bins.find((b) => b.id === selectedBin);
    if (!bin) return;

    setGenerating(true);
    try {
      const code = await generateCode(bin.id, bin.location, hoursValid);
      setLastGenerated(code);
      await loadData();
    } catch (err) {
      console.error("Failed to generate code:", err);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending: "badge badge-pending",
      completed: "badge badge-completed",
      expired: "badge badge-expired",
    };
    const label: Record<string, string> = {
      pending: "Aktif",
      completed: "Digunakan",
      expired: "Kadaluarsa",
    };
    return <span className={map[status] || "badge"}>{label[status] || status}</span>;
  };

  const statCards = [
    {
      label: "Total Pengambilan",
      value: stats?.totalPickups ?? "—",
      icon: <CheckCircle2 size={18} style={{ color: "var(--brand)" }} />,
      sub: "Sepanjang waktu",
    },
    {
      label: "Hari Ini",
      value: stats?.todayPickups ?? "—",
      icon: <Calendar size={18} style={{ color: "#60a5fa" }} />,
      sub: "Pengambilan hari ini",
    },
    {
      label: "Kode Aktif",
      value: stats?.activeCodes ?? "—",
      icon: <Zap size={18} style={{ color: "#eab308" }} />,
      sub: "Belum digunakan",
    },
    {
      label: "Total Bin",
      value: stats?.totalBins ?? "—",
      icon: <Trash2 size={18} style={{ color: "#a78bfa" }} />,
      sub: "Bin aktif",
    },
  ];

  return (
    <div className="space-y-8 animate-enter">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-2xl" style={{ color: "var(--text-primary)" }}>
            Dashboard
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
            {format(new Date(), "EEEE, d MMMM yyyy", { locale: idLocale })}
          </p>
        </div>
        <button onClick={loadData} className="btn-ghost self-start sm:self-auto">
          <RefreshCw size={15} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((s, i) => (
          <div key={i} className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
                {s.icon}
              </div>
            </div>
            <div className="font-display font-bold text-2xl mb-0.5" style={{ color: "var(--text-primary)" }}>
              {loadingStats ? <div className="skeleton w-12 h-7 inline-block" /> : s.value}
            </div>
            <div className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>{s.label}</div>
            <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Generate Code Panel */}
        <div className="lg:col-span-2 glass-card p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "var(--brand-dim)", border: "1px solid var(--border-strong)" }}>
              <Zap size={15} style={{ color: "var(--brand)" }} />
            </div>
            <div>
              <h2 className="font-display font-semibold" style={{ color: "var(--text-primary)" }}>
                Generate Kode
              </h2>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Buat kode baru untuk petugas</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                Pilih Bin
              </label>
              {bins.length === 0 ? (
                <div className="text-sm p-3 rounded-lg text-center" style={{ color: "var(--text-muted)", background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
                  Belum ada bin. <a href="/dashboard/bins" style={{ color: "var(--brand)" }}>Tambah bin →</a>
                </div>
              ) : (
                <select
                  className="input-base"
                  value={selectedBin}
                  onChange={(e) => setSelectedBin(e.target.value)}>
                  {bins.map((b) => (
                    <option key={b.id} value={b.id}
                      style={{ background: "var(--bg-elevated)", color: "var(--text-primary)" }}>
                      {b.location} — {b.address}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                Berlaku Selama
              </label>
              <select
                className="input-base"
                value={hoursValid}
                onChange={(e) => setHoursValid(Number(e.target.value))}>
                <option value={6} style={{ background: "var(--bg-elevated)" }}>6 Jam</option>
                <option value={12} style={{ background: "var(--bg-elevated)" }}>12 Jam</option>
                <option value={24} style={{ background: "var(--bg-elevated)" }}>24 Jam</option>
                <option value={48} style={{ background: "var(--bg-elevated)" }}>48 Jam</option>
              </select>
            </div>

            <button
              onClick={handleGenerate}
              disabled={generating || !selectedBin}
              className="btn-primary w-full justify-center py-2.5">
              {generating ? (
                <>
                  <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  Membuat...
                </>
              ) : (
                <>
                  <Plus size={15} /> Generate Kode
                </>
              )}
            </button>
          </div>


          {/* Last generated */}
          {lastGenerated && (() => {
            const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/pickup/${lastGenerated.code}` : "";
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(shareUrl)}`;

            return (
              <div className="mt-5 p-4 rounded-xl animate-enter space-y-4"
                style={{ background: "var(--brand-dim)", border: "1px solid var(--border-strong)" }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium" style={{ color: "var(--brand)" }}>Kode Baru Terbuat</span>
                  <div className="flex gap-2">
                    <button onClick={() => handleCopy(lastGenerated.code)} className="btn-ghost p-1"
                      style={{ fontSize: "0.725rem", gap: "0.25rem", padding: "0.2rem 0.5rem" }}>
                      {copied ? <Check size={12} /> : <Copy size={12} />}
                      {copied ? "Kode Disalin!" : "Salin Kode"}
                    </button>
                    <button onClick={() => {
                      if (typeof window !== "undefined") {
                        navigator.clipboard.writeText(shareUrl);
                        alert("Tautan absensi berhasil disalin!");
                      }
                    }} className="btn-ghost p-1"
                      style={{ fontSize: "0.725rem", gap: "0.25rem", padding: "0.2rem 0.5rem" }}>
                      <Copy size={12} /> Salin Link
                    </button>
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center py-3 bg-black/20 rounded-lg border border-white/5">
                  <div className="code-display text-2xl tracking-widest font-bold mb-3">{lastGenerated.code}</div>
                  
                  {/* QR Code */}
                  <div className="p-2.5 bg-white rounded-lg inline-block shadow-md">
                    <img src={qrUrl} alt="QR Code Absen" width={120} height={120} className="rounded" />
                  </div>
                  
                  <p className="text-[10px] mt-2.5 text-center px-4" style={{ color: "var(--text-muted)" }}>
                    Kirim link ini atau tunjukkan QR Code ke petugas di lapangan untuk absen instan!
                  </p>
                </div>

                <div className="flex items-center justify-center gap-1.5 text-xs pt-1" style={{ color: "var(--text-muted)" }}>
                  <Clock size={11} />
                  <span>Berlaku hingga {format(new Date(lastGenerated.expiresAt), "HH:mm, d MMM", { locale: idLocale })}</span>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Recent Codes */}
        <div className="lg:col-span-3 glass-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
            <h2 className="font-display font-semibold" style={{ color: "var(--text-primary)" }}>
              Kode Terbaru
            </h2>
            <a href="/history" className="text-xs flex items-center gap-1" style={{ color: "var(--brand)", textDecoration: "none" }}>
              Lihat semua <ChevronRight size={12} />
            </a>
          </div>
          <div className="overflow-x-auto">
            {recentCodes.length === 0 ? (
              <div className="p-8 text-center" style={{ color: "var(--text-muted)" }}>
                <Zap size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Belum ada kode yang digenerate</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Kode</th>
                    <th>Lokasi</th>
                    <th>Status</th>
                    <th>Dibuat</th>
                  </tr>
                </thead>
                <tbody>
                  {recentCodes.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <span className="font-mono text-sm" style={{ color: "var(--brand)", letterSpacing: "0.05em" }}>
                          {c.code}
                        </span>
                      </td>
                      <td className="text-sm" style={{ color: "var(--text-secondary)" }}>
                        {c.binLocation}
                      </td>
                      <td>{statusBadge(c.status)}</td>
                      <td className="text-sm" style={{ color: "var(--text-muted)" }}>
                        {format(new Date(c.generatedAt), "d MMM, HH:mm", { locale: idLocale })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
