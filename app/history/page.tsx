"use client";

import { useEffect, useState, useMemo } from "react";
import {
  History, Search, RefreshCw, Download, User, MapPin,
  Clock, Weight, FileText, ChevronDown, ChevronUp, Filter
} from "lucide-react";
import { getPickupHistory } from "@/services/pickup.service";
import { PickupRecord } from "@/types/pickup";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

export default function HistoryPage() {
  const [records, setRecords] = useState<PickupRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<"pickedUpAt" | "officerName" | "binLocation">("pickedUpAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getPickupHistory(100);
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
          r.officerName.toLowerCase().includes(q) ||
          r.binLocation.toLowerCase().includes(q) ||
          r.code.toLowerCase().includes(q)
      );
    }
    data.sort((a, b) => {
      let aVal = a[sortField] as string;
      let bVal = b[sortField] as string;
      if (sortField === "pickedUpAt") {
        aVal = new Date(a.pickedUpAt).toISOString();
        bVal = new Date(b.pickedUpAt).toISOString();
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
      ["Kode", "Petugas", "Telepon", "Lokasi Bin", "Berat (kg)", "Catatan", "Waktu Pengambilan"],
      ...filtered.map((r) => [
        r.code,
        r.officerName,
        r.officerPhone || "-",
        r.binLocation,
        r.weight ?? "-",
        r.notes || "-",
        format(new Date(r.pickedUpAt), "yyyy-MM-dd HH:mm"),
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `riwayat-pengambilan-${format(new Date(), "yyyyMMdd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-enter">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-2xl" style={{ color: "var(--text-primary)" }}>
            Riwayat Pengambilan
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
            {filtered.length} dari {records.length} record
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn-ghost">
            <RefreshCw size={15} />
          </button>
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
          placeholder="Cari kode, petugas, atau lokasi..."
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
              {search ? "Tidak ada hasil yang cocok" : "Belum ada riwayat pengambilan"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>
                    <button onClick={() => handleSort("pickedUpAt")}
                      className="flex items-center gap-1" style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", font: "inherit" }}>
                      Waktu <SortIcon field="pickedUpAt" />
                    </button>
                  </th>
                  <th>Kode</th>
                  <th>
                    <button onClick={() => handleSort("officerName")}
                      className="flex items-center gap-1" style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", font: "inherit" }}>
                      Petugas <SortIcon field="officerName" />
                    </button>
                  </th>
                  <th>
                    <button onClick={() => handleSort("binLocation")}
                      className="flex items-center gap-1" style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", font: "inherit" }}>
                      Lokasi <SortIcon field="binLocation" />
                    </button>
                  </th>
                  <th>Berat</th>
                  <th style={{ width: "40px" }} />
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <>
                    <tr key={r.id} style={{ cursor: "pointer" }}
                      onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                      <td>
                        <div className="text-sm" style={{ color: "var(--text-primary)" }}>
                          {format(new Date(r.pickedUpAt), "d MMM yyyy", { locale: idLocale })}
                        </div>
                        <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                          {format(new Date(r.pickedUpAt), "HH:mm")}
                        </div>
                      </td>
                      <td>
                        <span className="font-mono text-sm" style={{ color: "var(--brand)", letterSpacing: "0.05em" }}>
                          {r.code}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                            style={{ background: "var(--brand-dim)", color: "var(--brand)", border: "1px solid var(--border)" }}>
                            {r.officerName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm" style={{ color: "var(--text-primary)" }}>{r.officerName}</div>
                            {r.officerPhone && (
                              <div className="text-xs" style={{ color: "var(--text-muted)" }}>{r.officerPhone}</div>
                            )}
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
                        <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                          {r.weight ? `${r.weight} kg` : "—"}
                        </span>
                      </td>
                      <td>
                        <ChevronDown size={14} style={{
                          color: "var(--text-muted)",
                          transform: expanded === r.id ? "rotate(180deg)" : "none",
                          transition: "transform 0.2s"
                        }} />
                      </td>
                    </tr>
                    {expanded === r.id && (
                      <tr key={`${r.id}-detail`}>
                        <td colSpan={6} style={{ padding: 0 }}>
                          <div className="px-4 py-3 animate-enter" style={{ background: "var(--bg-elevated)", borderTop: "1px solid var(--border)" }}>
                            <div className="flex flex-wrap gap-4 text-sm">
                              <div className="flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
                                <Clock size={13} />
                                <span>ID Kode: <span style={{ color: "var(--text-secondary)" }}>{r.codeId}</span></span>
                              </div>
                              {r.notes && (
                                <div className="flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
                                  <FileText size={13} />
                                  <span>Catatan: <span style={{ color: "var(--text-secondary)" }}>{r.notes}</span></span>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
