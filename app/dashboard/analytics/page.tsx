"use client";

import { useEffect, useState, useMemo } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from "recharts";
import { BarChart3, RefreshCw, Printer, Calendar, Users, Trash2, AlertTriangle } from "lucide-react";
import { getAttendanceByRange } from "@/services/attendance.service";
import { Attendance } from "@/types/attendance";
import { format, subDays, eachDayOfInterval } from "date-fns";
import { id as idLocale } from "date-fns/locale";

const CHART_COLOR = "#10b981";
const CHART_MUTED = "#60a5fa";

export default function AnalyticsPage() {
  const [records, setRecords] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const endDate = new Date();
  const startDate = subDays(endDate, days);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getAttendanceByRange(startDate, endDate);
      setRecords(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [days]);

  // ── Daily trend ──
  const dailyData = useMemo(() => {
    const days_ = eachDayOfInterval({ start: startDate, end: endDate });
    const counts: Record<string, number> = {};
    for (const r of records) {
      const key = format(new Date(r.scannedAt), "yyyy-MM-dd");
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return days_.map((d) => ({
      date: format(d, "d MMM", { locale: idLocale }),
      absen: counts[format(d, "yyyy-MM-dd")] ?? 0,
    }));
  }, [records, days]);

  // ── Top officers ──
  const topOfficers = useMemo(() => {
    const counts: Record<string, { name: string; count: number }> = {};
    for (const r of records) {
      if (!counts[r.userId]) counts[r.userId] = { name: r.userName, count: 0 };
      counts[r.userId].count++;
    }
    return Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [records]);

  // ── Bin frequency ──
  const binFreq = useMemo(() => {
    const counts: Record<string, { name: string; count: number }> = {};
    for (const r of records) {
      if (!counts[r.binId]) counts[r.binId] = { name: r.binLocation, count: 0 };
      counts[r.binId].count++;
    }
    return Object.values(counts).sort((a, b) => b.count - a.count);
  }, [records]);

  const topBins = binFreq.slice(0, 5);
  const bottomBins = [...binFreq].sort((a, b) => a.count - b.count).slice(0, 5);

  const total = records.length;
  const uniqueOfficers = new Set(records.map((r) => r.userId)).size;
  const uniqueBins = new Set(records.map((r) => r.binId)).size;
  const avgPerDay = days > 0 ? (total / days).toFixed(1) : "0";

  return (
    <div className="space-y-6 animate-enter" id="analytics-content">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-2xl" style={{ color: "var(--text-primary)" }}>Analytics</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
            {format(startDate, "d MMM", { locale: idLocale })} — {format(endDate, "d MMM yyyy", { locale: idLocale })}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <select
            className="input-base"
            style={{ width: "auto" }}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}>
            <option value={7}>7 hari</option>
            <option value={30}>30 hari</option>
            <option value={90}>90 hari</option>
          </select>
          <button onClick={load} className="btn-ghost"><RefreshCw size={15} /></button>
          <button onClick={() => window.print()} className="btn-secondary">
            <Printer size={15} /> Cetak Laporan
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total Absensi", value: total, icon: <BarChart3 size={16} style={{ color: "var(--brand)" }} />, sub: `${days} hari terakhir` },
          { label: "Rata-rata/Hari", value: avgPerDay, icon: <Calendar size={16} style={{ color: "#60a5fa" }} />, sub: "Absen per hari" },
          { label: "Petugas Aktif", value: uniqueOfficers, icon: <Users size={16} style={{ color: "#eab308" }} />, sub: "Yang melakukan absen" },
          { label: "Bin Terjangkau", value: uniqueBins, icon: <Trash2 size={16} style={{ color: "#a78bfa" }} />, sub: "Dari total bin" },
        ].map((s, i) => (
          <div key={i} className="stat-card">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
              {s.icon}
            </div>
            {loading
              ? <div className="skeleton w-12 h-7 mb-1" />
              : <div className="font-display font-bold text-2xl mb-0.5" style={{ color: "var(--text-primary)" }}>{s.value}</div>}
            <div className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>{s.label}</div>
            <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="glass-card p-16 text-center" style={{ color: "var(--text-muted)" }}>
          <svg className="animate-spin mx-auto mb-2" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
          Memuat data...
        </div>
      ) : records.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <BarChart3 size={36} className="mx-auto mb-3 opacity-20" style={{ color: "var(--brand)" }} />
          <p style={{ color: "var(--text-secondary)" }}>Belum ada data dalam rentang ini</p>
        </div>
      ) : (
        <>
          {/* Daily trend chart */}
          <div className="glass-card p-5">
            <h2 className="font-display font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
              Tren Absensi Harian
            </h2>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fill: "var(--text-muted)", fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)" }} />
                <Line type="monotone" dataKey="absen" stroke={CHART_COLOR} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Top officers + bins */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="glass-card p-5">
              <h2 className="font-display font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Top 5 Petugas</h2>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={topOfficers} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" tick={{ fill: "var(--text-muted)", fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: "var(--text-muted)", fontSize: 11 }} width={90} />
                  <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)" }} />
                  <Bar dataKey="count" name="Absensi" fill={CHART_COLOR} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="glass-card p-5">
              <h2 className="font-display font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Top 5 Bin Terjangkau</h2>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={topBins} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" tick={{ fill: "var(--text-muted)", fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: "var(--text-muted)", fontSize: 11 }} width={90} />
                  <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)" }} />
                  <Bar dataKey="count" name="Absensi" fill={CHART_COLOR} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bins jarang disambangi */}
          {bottomBins.length > 0 && (
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle size={16} style={{ color: "#eab308" }} />
                <h2 className="font-display font-semibold" style={{ color: "var(--text-primary)" }}>Bin Jarang Disambangi</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead><tr><th>Lokasi Bin</th><th>Total Absensi</th><th>Status</th></tr></thead>
                  <tbody>
                    {bottomBins.map((b, i) => (
                      <tr key={i}>
                        <td className="text-sm" style={{ color: "var(--text-primary)" }}>{b.name}</td>
                        <td className="text-sm" style={{ color: "var(--text-secondary)" }}>{b.count}×</td>
                        <td>
                          <span className={`badge ${b.count === 0 ? "badge-expired" : b.count < 5 ? "badge-pending" : "badge-completed"}`} style={{ fontSize: "0.65rem" }}>
                            {b.count === 0 ? "Tidak pernah" : b.count < 5 ? "Jarang" : "Normal"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
