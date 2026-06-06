"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, MapPin, Package, X, Check, AlertCircle, QrCode, Copy, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { getTrashBins, addTrashBin } from "@/services/pickup.service";
import { TrashBin } from "@/types/pickup";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

export default function BinsPage() {
  const [bins, setBins] = useState<TrashBin[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [form, setForm] = useState({ location: "", address: "", capacity: 120 });

  const handleCopyCode = (binId: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(binId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const load = async () => {
    try {
      const data = await getTrashBins();
      setBins(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.location || !form.address) {
      setError("Lokasi dan alamat wajib diisi.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await addTrashBin(form.location, form.address, form.capacity);
      setSuccess(true);
      setForm({ location: "", address: "", capacity: 120 });
      await load();
      setTimeout(() => { setSuccess(false); setShowForm(false); }, 1500);
    } catch {
      setError("Gagal menambahkan bin. Coba lagi.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-enter">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl" style={{ color: "var(--text-primary)" }}>Kelola Bin</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>{bins.length} bin terdaftar</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn-ghost"><RefreshCw size={15} /></button>
          <button onClick={() => setShowForm(true)} className="btn-primary">
            <Plus size={16} /> Tambah Bin
          </button>
        </div>
      </div>

      {/* Info callout */}
      <div className="p-3 rounded-xl text-sm flex items-start gap-2.5"
        style={{ background: "var(--brand-dim)", border: "1px solid var(--border-strong)", color: "var(--text-secondary)" }}>
        <QrCode size={15} className="mt-0.5 flex-shrink-0" style={{ color: "var(--brand)" }} />
        <span>
          Setiap bin memiliki <strong style={{ color: "var(--brand)" }}>Kode Lokasi</strong> unik yang di-generate otomatis saat ditambahkan.
          Konfigurasikan kode ini pada perangkat scanner Python di tiap bin.
        </span>
      </div>

      {/* Add Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative glass-card w-full max-w-md p-6 animate-enter">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display font-semibold" style={{ color: "var(--text-primary)" }}>Tambah Bin Baru</h2>
              <button onClick={() => setShowForm(false)} className="btn-ghost p-1.5"><X size={16} /></button>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg mb-4 text-sm"
                style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444" }}>
                <AlertCircle size={14} /> {error}
              </div>
            )}
            {success && (
              <div className="flex items-center gap-2 p-3 rounded-lg mb-4 text-sm"
                style={{ background: "var(--brand-dim)", border: "1px solid var(--border-strong)", color: "var(--brand)" }}>
                <Check size={14} /> Bin berhasil ditambahkan!
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Nama Lokasi</label>
                <input className="input-base" placeholder="e.g. Blok A – Taman Kota" value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Alamat Lengkap</label>
                <input className="input-base" placeholder="e.g. Jl. Sudirman No. 1, Jakarta" value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Kapasitas (Liter)</label>
                <input type="number" className="input-base" min={10} max={1000} value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} />
              </div>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Kode lokasi unik akan di-generate otomatis dan ditampilkan setelah bin disimpan.
              </p>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1 justify-center">Batal</button>
                <button type="submit" className="btn-primary flex-1 justify-center" disabled={submitting}>
                  {submitting ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bins Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="stat-card">
              <div className="skeleton w-10 h-10 rounded-lg mb-3" />
              <div className="skeleton w-3/4 h-4 mb-2" />
              <div className="skeleton w-full h-3" />
            </div>
          ))}
        </div>
      ) : bins.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <Trash2 size={40} className="mx-auto mb-4 opacity-20" style={{ color: "var(--brand)" }} />
          <p className="font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Belum ada bin</p>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Tambahkan bin sampah pertama Anda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {bins.map((bin, i) => (
            <div key={bin.id} className="stat-card group" style={{ animationDelay: `${i * 0.05}s` }}>
              {/* Online/Offline badge */}
              {(() => {
                const now = Date.now();
                const lastSeen = bin.lastSeenAt ? new Date(bin.lastSeenAt).getTime() : null;
                const diffMin = lastSeen ? Math.floor((now - lastSeen) / 60000) : null;
                let scannerBadge;
                if (!lastSeen) {
                  scannerBadge = null;
                } else if (diffMin! < 3) {
                  scannerBadge = <span className="badge badge-completed flex items-center gap-1" style={{ fontSize: "0.65rem" }}><Wifi size={10} /> Online</span>;
                } else if (diffMin! < 30) {
                  scannerBadge = <span className="badge badge-pending flex items-center gap-1" style={{ fontSize: "0.65rem" }}><Wifi size={10} /> Lambat ({diffMin}m)</span>;
                } else {
                  scannerBadge = <span className="badge badge-expired flex items-center gap-1" style={{ fontSize: "0.65rem" }}><WifiOff size={10} /> Offline ({diffMin}m)</span>;
                }
                return (
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: "var(--brand-dim)", border: "1px solid var(--border-strong)" }}>
                      <Trash2 size={18} style={{ color: "var(--brand)" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-display font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                        {bin.location}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                        <span className="badge badge-completed" style={{ fontSize: "0.7rem" }}>Aktif</span>
                        {scannerBadge}
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2" style={{ color: "var(--text-muted)" }}>
                  <MapPin size={13} className="mt-0.5 flex-shrink-0" />
                  <span className="leading-relaxed">{bin.address}</span>
                </div>
                <div className="flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
                  <Package size={13} />
                  <span>Kapasitas: {bin.capacity} Liter</span>
                </div>

                {/* Bin code display */}
                <div className="flex items-center justify-between gap-2 mt-3 p-2 rounded-lg"
                  style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
                  <div className="flex items-center gap-2">
                    <QrCode size={13} style={{ color: "var(--brand)" }} />
                    <span className="font-mono text-xs font-bold" style={{ color: "var(--brand)" }}>
                      {bin.code}
                    </span>
                  </div>
                  <button
                    onClick={() => handleCopyCode(bin.id, bin.code)}
                    className="btn-ghost p-0.5"
                    title="Salin kode"
                    style={{ fontSize: "0.7rem" }}>
                    {copiedId === bin.id ? <Check size={13} style={{ color: "var(--brand)" }} /> : <Copy size={13} />}
                  </button>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t text-xs" style={{ borderColor: "var(--border)", color: "var(--text-ghost)" }}>
                Ditambahkan {format(new Date(bin.createdAt), "d MMM yyyy", { locale: idLocale })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
