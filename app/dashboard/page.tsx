"use client";

import { useEffect, useState } from "react";
import {
  BarChart3, Trash2, CheckCircle2, RefreshCw,
  Zap, Calendar, Users, ChevronRight, MapPin, Clock
} from "lucide-react";
import { getDashboardStats } from "@/services/pickup.service";
import { getAttendanceHistory } from "@/services/attendance.service";
import { Attendance } from "@/types/attendance";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

interface Stats {
  totalAttendances: number;
  todayAttendances: number;
  activeOfficers: number;
  totalBins: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentAttendances, setRecentAttendances] = useState<Attendance[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);

  const loadData = async () => {
    try {
      const [statsData, attendances] = await Promise.all([
        getDashboardStats(),
        getAttendanceHistory(10),
      ]);
      setStats(statsData);
      setRecentAttendances(attendances);
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const statCards = [
    {
      label: "Total Absensi",
      value: stats?.totalAttendances ?? "—",
      icon: <CheckCircle2 size={18} style={{ color: "var(--brand)" }} />,
      sub: "Sepanjang waktu",
    },
    {
      label: "Hari Ini",
      value: stats?.todayAttendances ?? "—",
      icon: <Calendar size={18} style={{ color: "#60a5fa" }} />,
      sub: "Absensi hari ini",
    },
    {
      label: "Petugas Aktif",
      value: stats?.activeOfficers ?? "—",
      icon: <Users size={18} style={{ color: "#eab308" }} />,
      sub: "Terdaftar & aktif",
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
        {/* Quick Actions */}
        <div className="lg:col-span-2 glass-card p-6 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "var(--brand-dim)", border: "1px solid var(--border-strong)" }}>
              <Zap size={15} style={{ color: "var(--brand)" }} />
            </div>
            <div>
              <h2 className="font-display font-semibold" style={{ color: "var(--text-primary)" }}>Aksi Cepat</h2>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Kelola sistem absensi</p>
            </div>
          </div>

          <a href="/dashboard/users"
            className="flex items-center justify-between p-4 rounded-xl transition-colors"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", textDecoration: "none" }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ background: "var(--brand-dim)", border: "1px solid var(--border-strong)" }}>
                <Users size={16} style={{ color: "var(--brand)" }} />
              </div>
              <div>
                <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Kelola Petugas</div>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>Tambah & cetak QR petugas</div>
              </div>
            </div>
            <ChevronRight size={16} style={{ color: "var(--text-muted)" }} />
          </a>

          <a href="/dashboard/bins"
            className="flex items-center justify-between p-4 rounded-xl transition-colors"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", textDecoration: "none" }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
                <Trash2 size={16} style={{ color: "#a78bfa" }} />
              </div>
              <div>
                <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Kelola Bin</div>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>Lihat kode lokasi bin</div>
              </div>
            </div>
            <ChevronRight size={16} style={{ color: "var(--text-muted)" }} />
          </a>

          <a href="/history"
            className="flex items-center justify-between p-4 rounded-xl transition-colors"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", textDecoration: "none" }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
                <BarChart3 size={16} style={{ color: "#60a5fa" }} />
              </div>
              <div>
                <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Riwayat Absensi</div>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>Lihat semua log scan QR</div>
              </div>
            </div>
            <ChevronRight size={16} style={{ color: "var(--text-muted)" }} />
          </a>
        </div>

        {/* Recent Attendances */}
        <div className="lg:col-span-3 glass-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
            <h2 className="font-display font-semibold" style={{ color: "var(--text-primary)" }}>
              Absensi Terbaru
            </h2>
            <a href="/history" className="text-xs flex items-center gap-1" style={{ color: "var(--brand)", textDecoration: "none" }}>
              Lihat semua <ChevronRight size={12} />
            </a>
          </div>
          <div className="overflow-x-auto">
            {recentAttendances.length === 0 ? (
              <div className="p-8 text-center" style={{ color: "var(--text-muted)" }}>
                <CheckCircle2 size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Belum ada absensi</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Petugas</th>
                    <th>Lokasi</th>
                    <th>Waktu</th>
                  </tr>
                </thead>
                <tbody>
                  {recentAttendances.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                            style={{ background: "var(--brand-dim)", color: "var(--brand)", border: "1px solid var(--border)" }}>
                            {a.userName.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm" style={{ color: "var(--text-primary)" }}>{a.userName}</span>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5 text-sm" style={{ color: "var(--text-secondary)" }}>
                          <MapPin size={12} />
                          {a.binLocation}
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5 text-sm" style={{ color: "var(--text-muted)" }}>
                          <Clock size={12} />
                          {format(new Date(a.scannedAt), "d MMM, HH:mm", { locale: idLocale })}
                        </div>
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
