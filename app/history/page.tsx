"use client";

import { useEffect, useState, useMemo } from "react";
import {
  History, Search, RefreshCw, Download,
  MapPin, Clock, ChevronDown, ChevronUp
} from "lucide-react";
import { getAttendanceHistory } from "@/services/attendance.service";
import { Attendance } from "@/types/attendance";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

export default function HistoryPage() {
  const [records, setRecords] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<"scannedAt" | "userName" | "binLocation">("scannedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const load = async () => {
    setLoading(true);
    try {
      const data = await getAttendanceHistory(100);
      setRecords(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let data = [...records];
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(
        (r) =>
          r.userName.toLowerCase().includes(q) ||
          r.binLocation.toLowerCase().includes(q) ||
          r.userCode.toLowerCase().includes(q) ||
          r.binCode.toLowerCase().includes(q)
      );
    }
    data.sort((a, b) => {
      let aVal: string;
      let bVal: string;
      if (sortField === "scannedAt") {
        aVal = new Date(a.scannedAt).toISOString();
        bVal = new Date(b.scannedAt).toISOString();
      } else {
        aVal = a[sortField];
        bVal = b[sortField];
      }
      if (sortDir === "asc") return aVal > bVal ? 1 : -1;
      return aVal < bVal ? 1 : -1;
    });
    return data;
  }, [records, search, sortField, sortDir]);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const SortIcon = ({ field }: { field: typeof sortField }) => {
    if (sortField !== field) return <ChevronDown size={12} style={{ opacity: 0.3 }} />;
    return sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
  };

  const exportCSV = () => {
    const rows = [
      ["Petugas", "Kode User", "Lokasi Bin", "Kode Bin", "Waktu Scan"],
      ...filtered.map((r) => [
        r.userName,
        r.userCode,
        r.binLocation,
        r.binCode,
        format(new Date(r.scannedAt), "yyyy-MM-dd HH:mm"),
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `riwayat-absensi-${format(new Date(), "yyyyMMdd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-enter">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-2xl" style={{ color: "var(--text-primary)" }}>
            Riwayat Absensi
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
            {filtered.length} dari {records.length} record
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn-ghost"><RefreshCw size={15} /></button>
          <button onClick={exportCSV} className="btn-secondary" disabled={filtered.length === 0}>
            <Download size={15} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2"
          style={{ color: "var(--text-muted)" }} />
        <input
          className="input-base pl-9"
          placeholder="Cari petugas, lokasi, atau kode..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-10 text-center">
            <div className="inline-flex items-center gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
              <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              Memuat data...
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <History size={36} className="mx-auto mb-3 opacity-20" style={{ color: "var(--brand)" }} />
            <p className="font-medium" style={{ color: "var(--text-secondary)" }}>
              {search ? "Tidak ada hasil yang cocok" : "Belum ada riwayat absensi"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>
                    <button onClick={() => handleSort("scannedAt")}
                      className="flex items-center gap-1"
                      style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", font: "inherit" }}>
                      Waktu <SortIcon field="scannedAt" />
                    </button>
                  </th>
                  <th>
                    <button onClick={() => handleSort("userName")}
                      className="flex items-center gap-1"
                      style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", font: "inherit" }}>
                      Petugas <SortIcon field="userName" />
                    </button>
                  </th>
                  <th>
                    <button onClick={() => handleSort("binLocation")}
                      className="flex items-center gap-1"
                      style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", font: "inherit" }}>
                      Lokasi <SortIcon field="binLocation" />
                    </button>
                  </th>
                  <th>Kode Bin</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className="text-sm" style={{ color: "var(--text-primary)" }}>
                        {format(new Date(r.scannedAt), "d MMM yyyy", { locale: idLocale })}
                      </div>
                      <div className="text-xs mt-0.5 flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                        <Clock size={10} />
                        {format(new Date(r.scannedAt), "HH:mm")}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ background: "var(--brand-dim)", color: "var(--brand)", border: "1px solid var(--border)" }}>
                          {r.userName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm" style={{ color: "var(--text-primary)" }}>{r.userName}</div>
                          <div className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>{r.userCode}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5 text-sm" style={{ color: "var(--text-secondary)" }}>
                        <MapPin size={12} />
                        {r.binLocation}
                      </div>
                    </td>
                    <td>
                      <span className="font-mono text-sm" style={{ color: "var(--brand)", letterSpacing: "0.05em" }}>
                        {r.binCode}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
