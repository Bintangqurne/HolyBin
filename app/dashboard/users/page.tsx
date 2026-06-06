"use client";

import { useEffect, useState, useRef } from "react";
import {
  Plus, User, QrCode, X, Check, AlertCircle, Phone,
  UserX, RefreshCw, Printer, Copy, Upload, FileText
} from "lucide-react";
import { getOfficers, addOfficer, deactivateOfficer } from "@/services/user.service";
import { Officer, OfficerRole } from "@/types/user";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

const ROLE_LABEL: Record<OfficerRole, string> = {
  pemulung: "Pemulung",
  kebersihan: "Kebersihan",
};

interface CsvRow { name: string; phone: string; role: OfficerRole; valid: boolean; error?: string }

export default function UsersPage() {
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showCsv, setShowCsv] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [selectedOfficer, setSelectedOfficer] = useState<Officer | null>(null);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState<{ name: string; phone: string; role: OfficerRole }>({ name: "", phone: "", role: "pemulung" });

  // CSV state
  const fileRef = useRef<HTMLInputElement>(null);
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvResult, setCsvResult] = useState<{ ok: number; skipped: number } | null>(null);

  const load = async () => {
    try {
      const data = await getOfficers();
      setOfficers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // ── Single add ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.phone) { setError("Nama dan nomor telepon wajib diisi."); return; }
    setSubmitting(true); setError("");
    try {
      await addOfficer(form.name, form.phone, form.role);
      setSuccess(true); setForm({ name: "", phone: "", role: "pemulung" }); await load();
      setTimeout(() => { setSuccess(false); setShowForm(false); }, 1500);
    } catch { setError("Gagal menambahkan petugas. Coba lagi."); }
    finally { setSubmitting(false); }
  };

  const handleDeactivate = async (id: string, name: string) => {
    if (!confirm(`Nonaktifkan petugas "${name}"?`)) return;
    try { await deactivateOfficer(id); await load(); }
    catch { alert("Gagal menonaktifkan petugas."); }
  };

  // ── CSV import ──
  const parseCsv = (text: string): CsvRow[] => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    const rows: CsvRow[] = [];
    for (const line of lines) {
      const [rawName, rawPhone, rawRole] = line.split(",");
      const name = rawName?.trim().replace(/^["']|["']$/g, "") ?? "";
      const phone = rawPhone?.trim().replace(/^["']|["']$/g, "") ?? "";
      const roleRaw = (rawRole?.trim().replace(/^["']|["']$/g, "") ?? "").toLowerCase();
      const role: OfficerRole = roleRaw === "kebersihan" ? "kebersihan" : "pemulung";
      // skip header row
      if (name.toLowerCase() === "name" || name.toLowerCase() === "nama") continue;
      if (!name) continue;
      if (!phone) { rows.push({ name, phone, role, valid: false, error: "Nomor telepon kosong" }); continue; }
      rows.push({ name, phone, role, valid: true });
    }
    return rows;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setCsvRows(parseCsv(text));
      setCsvResult(null);
    };
    reader.readAsText(file);
  };

  const handleCsvImport = async () => {
    const valid = csvRows.filter((r) => r.valid);
    if (!valid.length) return;
    setCsvImporting(true); setCsvResult(null);
    let ok = 0, skipped = 0;
    for (const row of csvRows) {
      if (!row.valid) { skipped++; continue; }
      try { await addOfficer(row.name, row.phone, row.role); ok++; }
      catch { skipped++; }
    }
    setCsvResult({ ok, skipped });
    setCsvImporting(false);
    await load();
  };

  // ── Print all QRs ──
  const handlePrintAllQrs = () => {
    if (typeof window === "undefined" || officers.length === 0) return;
    const activeOfficers = officers.filter((o) => o.isActive);
    const cards = activeOfficers.map((o) => {
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(o.userCode)}`;
      return `
        <div class="card">
          <div class="qr-box"><img src="${qrUrl}" width="160" height="160" /></div>
          <div class="name">${o.name}</div>
          <div class="sub">${o.phone}</div>
          <div class="code">${o.userCode}</div>
        </div>`;
    }).join("");

    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`
      <html>
        <head>
          <title>QR Petugas — HolyBin</title>
          <style>
            body { font-family: -apple-system, sans-serif; margin: 0; padding: 20px; background: #fff; }
            h1 { font-size: 16px; color: #10b981; text-align: center; margin-bottom: 20px; }
            .grid { display: flex; flex-wrap: wrap; gap: 16px; justify-content: center; }
            .card { border: 2px solid #10b981; border-radius: 12px; padding: 16px; text-align: center; width: 200px; break-inside: avoid; }
            .qr-box { margin-bottom: 10px; }
            .name { font-weight: 700; font-size: 14px; }
            .sub { font-size: 12px; color: #6b7280; margin: 2px 0; }
            .code { font-family: monospace; font-size: 13px; color: #10b981; font-weight: 700; }
            @media print { body { padding: 0; } h1 { margin-top: 0; } }
          </style>
        </head>
        <body>
          <h1>HolyBin — QR Card Petugas (${activeOfficers.length} orang)</h1>
          <div class="grid">${cards}</div>
          <script>window.onload = function() { window.print(); };<\/script>
        </body>
      </html>
    `);
    w.document.close();
  };

  // ── Print single QR ──
  const handlePrintQr = (officer: Officer) => {
    if (typeof window === "undefined") return;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(officer.userCode)}`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><title>QR — ${officer.name}</title><style>body{font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center}.container{border:3px solid #10b981;padding:40px;border-radius:24px;max-width:420px}.logo{font-size:26px;font-weight:800;color:#10b981;margin-bottom:5px}.qr-box{padding:15px;border-radius:16px;border:1px solid #e5e7eb;display:inline-block;margin-bottom:20px}.name{font-size:24px;font-weight:800;color:#1f2937;margin:0 0 6px}.phone{font-size:14px;color:#4b5563;margin:0 0 6px}.code{font-size:13px;font-family:monospace;color:#10b981;font-weight:700;margin:0 0 20px}.footer{font-size:11px;color:#9ca3af;border-top:1px dashed #e5e7eb;padding-top:15px}</style></head><body><div class="container"><div class="logo">HolyBin</div><div class="qr-box"><img src="${qrUrl}" width="250" height="250"/></div><div class="name">${officer.name}</div><div class="phone">${officer.phone}</div><div class="code">${officer.userCode}</div><div class="footer">TUNJUKKAN QR INI KE SCANNER DI LOKASI BIN</div></div><script>window.onload=function(){window.print();setTimeout(function(){window.close();},500);}<\/script></body></html>`);
    w.document.close();
  };

  return (
    <div className="space-y-6 animate-enter">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="font-display font-bold text-2xl" style={{ color: "var(--text-primary)" }}>Kelola Petugas</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>{officers.filter((o) => o.isActive).length} petugas aktif</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={load} className="btn-ghost"><RefreshCw size={15} /></button>
          <button onClick={handlePrintAllQrs} className="btn-secondary" disabled={officers.filter(o => o.isActive).length === 0}>
            <Printer size={15} /> Cetak Semua QR
          </button>
          <button onClick={() => { setShowCsv(true); setCsvRows([]); setCsvResult(null); }} className="btn-secondary">
            <Upload size={15} /> Import CSV
          </button>
          <button onClick={() => setShowForm(true)} className="btn-primary">
            <Plus size={16} /> Tambah Petugas
          </button>
        </div>
      </div>

      {/* Single Add Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative glass-card w-full max-w-md p-6 animate-enter">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display font-semibold" style={{ color: "var(--text-primary)" }}>Tambah Petugas</h2>
              <button onClick={() => setShowForm(false)} className="btn-ghost p-1.5"><X size={16} /></button>
            </div>
            {error && <div className="flex items-center gap-2 p-3 rounded-lg mb-4 text-sm" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444" }}><AlertCircle size={14} /> {error}</div>}
            {success && <div className="flex items-center gap-2 p-3 rounded-lg mb-4 text-sm" style={{ background: "var(--brand-dim)", border: "1px solid var(--border-strong)", color: "var(--brand)" }}><Check size={14} /> Berhasil ditambahkan!</div>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Nama Lengkap</label>
                <input className="input-base" placeholder="Andi Santoso" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Nomor Telepon</label>
                <input className="input-base" placeholder="08123456789" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Tugas Petugas</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["pemulung", "kebersihan"] as OfficerRole[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setForm({ ...form, role: r })}
                      className={form.role === r ? "btn-primary justify-center" : "btn-secondary justify-center"}
                    >
                      {ROLE_LABEL[r]}
                    </button>
                  ))}
                </div>
                <p className="text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>
                  {form.role === "pemulung"
                    ? "Buka kompartemen sampah bisa dipulung (servo 2)."
                    : "Buka kompartemen sampah tidak bisa dipulung (servo 3)."}
                </p>
              </div>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Kode QR unik digenerate otomatis.</p>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1 justify-center">Batal</button>
                <button type="submit" className="btn-primary flex-1 justify-center" disabled={submitting}>{submitting ? "Menyimpan..." : "Simpan"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {showCsv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowCsv(false)} />
          <div className="relative glass-card w-full max-w-2xl p-6 animate-enter">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FileText size={18} style={{ color: "var(--brand)" }} />
                <h2 className="font-display font-semibold" style={{ color: "var(--text-primary)" }}>Import CSV Petugas</h2>
              </div>
              <button onClick={() => setShowCsv(false)} className="btn-ghost p-1.5"><X size={16} /></button>
            </div>

            <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
              Format CSV: <code className="px-1 rounded" style={{ background: "var(--bg-elevated)" }}>name,phone,role</code> — satu baris per petugas. Kolom role: <code className="px-1 rounded" style={{ background: "var(--bg-elevated)" }}>pemulung</code> / <code className="px-1 rounded" style={{ background: "var(--bg-elevated)" }}>kebersihan</code> (default pemulung). Header opsional.
            </p>

            <label className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-dashed cursor-pointer mb-4 transition-colors"
              style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}>
              <Upload size={24} style={{ color: "var(--text-muted)" }} />
              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Klik untuk pilih file CSV</span>
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileChange} />
            </label>

            {csvRows.length > 0 && (
              <div className="mb-4 max-h-48 overflow-y-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
                <table className="data-table">
                  <thead><tr><th>#</th><th>Nama</th><th>Telepon</th><th>Tugas</th><th>Status</th></tr></thead>
                  <tbody>
                    {csvRows.map((r, i) => (
                      <tr key={i}>
                        <td className="text-xs" style={{ color: "var(--text-ghost)" }}>{i + 1}</td>
                        <td className="text-sm" style={{ color: "var(--text-primary)" }}>{r.name}</td>
                        <td className="text-sm" style={{ color: "var(--text-secondary)" }}>{r.phone || "—"}</td>
                        <td className="text-sm" style={{ color: "var(--text-secondary)" }}>{ROLE_LABEL[r.role]}</td>
                        <td>
                          {r.valid
                            ? <span className="badge badge-completed" style={{ fontSize: "0.65rem" }}>Valid</span>
                            : <span className="badge badge-expired" style={{ fontSize: "0.65rem" }}>{r.error || "Tidak valid"}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {csvResult && (
              <div className="p-3 rounded-lg mb-4 text-sm" style={{ background: "var(--brand-dim)", border: "1px solid var(--border-strong)", color: "var(--brand)" }}>
                <Check size={14} className="inline mr-1" />
                {csvResult.ok} petugas berhasil ditambahkan{csvResult.skipped > 0 ? `, ${csvResult.skipped} dilewati` : ""}.
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setShowCsv(false)} className="btn-secondary flex-1 justify-center">Tutup</button>
              <button
                onClick={handleCsvImport}
                className="btn-primary flex-1 justify-center"
                disabled={csvImporting || csvRows.filter(r => r.valid).length === 0}>
                {csvImporting ? "Mengimpor..." : `Import ${csvRows.filter(r => r.valid).length} Petugas`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Officers Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (<div key={i} className="stat-card"><div className="skeleton w-10 h-10 rounded-full mb-3" /><div className="skeleton w-3/4 h-4 mb-2" /><div className="skeleton w-full h-3" /></div>))}
        </div>
      ) : officers.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <User size={40} className="mx-auto mb-4 opacity-20" style={{ color: "var(--brand)" }} />
          <p className="font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Belum ada petugas</p>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Tambah manual atau import CSV.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {officers.map((officer, i) => (
            <div key={officer.id} className="stat-card group" style={{ animationDelay: `${i * 0.05}s`, opacity: officer.isActive ? 1 : 0.5 }}>
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{ background: "var(--brand-dim)", color: "var(--brand)", border: "1px solid var(--border-strong)" }}>
                  {officer.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display font-semibold truncate" style={{ color: "var(--text-primary)" }}>{officer.name}</div>
                  <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                    <span className={`badge ${officer.isActive ? "badge-completed" : "badge-expired"}`} style={{ fontSize: "0.7rem" }}>
                      {officer.isActive ? "Aktif" : "Nonaktif"}
                    </span>
                    <span className="badge" style={{ fontSize: "0.7rem", background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                      {ROLE_LABEL[officer.role]}
                    </span>
                  </div>
                </div>
                <button onClick={() => setSelectedOfficer(officer)} className="p-1.5 btn-ghost flex-shrink-0 text-zinc-400 hover:text-emerald-400" title="QR"><QrCode size={16} /></button>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2" style={{ color: "var(--text-muted)" }}><Phone size={13} /><span>{officer.phone}</span></div>
                <div className="flex items-center gap-2" style={{ color: "var(--text-muted)" }}><QrCode size={13} /><span className="font-mono text-xs" style={{ color: "var(--brand)" }}>{officer.userCode}</span></div>
              </div>
              <div className="mt-4 pt-3 border-t flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
                <span className="text-xs" style={{ color: "var(--text-ghost)" }}>
                  {format(new Date(officer.createdAt), "d MMM yyyy", { locale: idLocale })}
                </span>
                {officer.isActive && (
                  <button onClick={() => handleDeactivate(officer.id, officer.name)} className="btn-ghost p-1 text-xs flex items-center gap-1" style={{ color: "#ef4444", fontSize: "0.7rem" }}>
                    <UserX size={12} /> Nonaktifkan
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* QR Modal */}
      {selectedOfficer && (() => {
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(selectedOfficer.userCode)}`;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => { setSelectedOfficer(null); setCopied(false); }} />
            <div className="relative glass-card w-full max-w-md p-6 animate-enter">
              <div className="flex items-center justify-between mb-5 border-b pb-3" style={{ borderColor: "var(--border)" }}>
                <div className="flex items-center gap-2"><QrCode size={18} style={{ color: "var(--brand)" }} /><h3 className="font-display font-semibold text-lg" style={{ color: "var(--text-primary)" }}>QR Petugas</h3></div>
                <button onClick={() => { setSelectedOfficer(null); setCopied(false); }} className="btn-ghost p-1.5"><X size={16} /></button>
              </div>
              <div className="flex flex-col items-center text-center space-y-5 py-2">
                <div className="p-3 bg-white rounded-2xl shadow-xl border border-zinc-200"><img src={qrUrl} alt="QR" width={180} height={180} className="rounded" /></div>
                <div><h4 className="font-display font-semibold text-base" style={{ color: "var(--text-primary)" }}>{selectedOfficer.name}</h4><p className="text-xs" style={{ color: "var(--text-muted)" }}>{selectedOfficer.phone}</p></div>
                <div className="w-full p-2.5 rounded-xl bg-black/25 border flex items-center justify-between gap-3" style={{ borderColor: "var(--border)" }}>
                  <span className="font-mono text-sm flex-1 text-left" style={{ color: "var(--brand)" }}>{selectedOfficer.userCode}</span>
                  <button onClick={() => { navigator.clipboard.writeText(selectedOfficer.userCode); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="btn-primary py-1 px-3 text-xs">
                    {copied ? <Check size={12} /> : <Copy size={12} />}{copied ? "Disalin!" : "Salin"}
                  </button>
                </div>
              </div>
              <div className="flex gap-3 pt-4 mt-2 border-t" style={{ borderColor: "var(--border)" }}>
                <button onClick={() => handlePrintQr(selectedOfficer)} className="btn-primary flex-1 justify-center py-2.5"><Printer size={15} /> Cetak QR</button>
                <button onClick={() => { setSelectedOfficer(null); setCopied(false); }} className="btn-secondary flex-1 justify-center py-2.5">Tutup</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
