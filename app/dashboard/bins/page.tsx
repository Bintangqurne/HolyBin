"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, MapPin, Package, X, Check, AlertCircle, QrCode, Copy, Printer } from "lucide-react";
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
  const [selectedBinForQr, setSelectedBinForQr] = useState<TrashBin | null>(null);
  const [copied, setCopied] = useState(false);

  const [form, setForm] = useState({ location: "", address: "", capacity: 120 });

  const handlePrintQr = (bin: TrashBin) => {
    if (typeof window === "undefined") return;
    const binLink = `${window.location.origin}/pickup?binId=${bin.id}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(binLink)}`;
    
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Cetak QR Code - ${bin.location}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              text-align: center;
              background-color: #ffffff;
            }
            .container {
              border: 3px solid #10b981;
              padding: 40px;
              border-radius: 24px;
              box-shadow: 0 10px 30px rgba(0,0,0,0.05);
              max-width: 450px;
            }
            .logo {
              font-size: 26px;
              font-weight: 800;
              color: #10b981;
              margin-bottom: 5px;
              letter-spacing: -0.025em;
            }
            .sublogo {
              font-size: 11px;
              color: #6b7280;
              margin-bottom: 25px;
              text-transform: uppercase;
              letter-spacing: 0.15em;
              font-weight: 600;
            }
            .qr-box {
              background: white;
              padding: 15px;
              border-radius: 16px;
              border: 1px solid #e5e7eb;
              display: inline-block;
              margin-bottom: 25px;
            }
            .location {
              font-size: 24px;
              font-weight: 800;
              color: #1f2937;
              margin: 0 0 10px 0;
            }
            .address {
              font-size: 14px;
              color: #4b5563;
              margin: 0 0 25px 0;
              line-height: 1.5;
            }
            .footer-text {
              font-size: 11px;
              color: #9ca3af;
              border-top: 1px dashed #e5e7eb;
              padding-top: 15px;
              font-weight: 500;
              letter-spacing: 0.05em;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo">TrashSync</div>
            <div class="sublogo">Smart Trash Management</div>
            <div class="qr-box">
              <img src="${qrUrl}" alt="QR Code" width="250" height="250" />
            </div>
            <div class="location">${bin.location}</div>
            <div class="address">${bin.address}</div>
            <div class="footer-text">PINDAI QR CODE INI UNTUK ABSENSI PENGAMBILAN SAMPAH INSTAN</div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleCopyLink = (binId: string) => {
    if (typeof window === "undefined") return;
    const binLink = `${window.location.origin}/pickup?binId=${binId}`;
    navigator.clipboard.writeText(binLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
    } catch (err) {
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
        <button onClick={() => setShowForm(true)} className="btn-primary">
          <Plus size={16} /> Tambah Bin
        </button>
      </div>

      {/* Add Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative glass-card w-full max-w-md p-6 animate-enter">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display font-semibold" style={{ color: "var(--text-primary)" }}>Tambah Bin Baru</h2>
              <button onClick={() => setShowForm(false)} className="btn-ghost p-1.5">
                <X size={16} />
              </button>
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
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1 justify-center">
                  Batal
                </button>
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
          {[1, 2, 3].map(i => (
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
            <div key={bin.id} className="stat-card group"
              style={{ animationDelay: `${i * 0.05}s` }}>
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "var(--brand-dim)", border: "1px solid var(--border-strong)" }}>
                  <Trash2 size={18} style={{ color: "var(--brand)" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                    {bin.location}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="badge badge-completed" style={{ fontSize: "0.7rem" }}>Aktif</span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedBinForQr(bin)}
                  className="p-1.5 rounded-lg btn-ghost flex-shrink-0 self-start text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all duration-200"
                  title="Tampilkan QR Code Bin"
                >
                  <QrCode size={16} />
                </button>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2" style={{ color: "var(--text-muted)" }}>
                  <MapPin size={13} className="mt-0.5 flex-shrink-0" />
                  <span className="leading-relaxed">{bin.address}</span>
                </div>
                <div className="flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
                  <Package size={13} />
                  <span>Kapasitas: {bin.capacity} Liter</span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t text-xs" style={{ borderColor: "var(--border)", color: "var(--text-ghost)" }}>
                Ditambahkan {format(new Date(bin.createdAt), "d MMM yyyy", { locale: idLocale })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* STATIC QR CODE PREMIUM MODAL */}
      {selectedBinForQr && (() => {
        const binLink = typeof window !== "undefined" ? `${window.location.origin}/pickup?binId=${selectedBinForQr.id}` : "";
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(binLink)}`;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => { setSelectedBinForQr(null); setCopied(false); }} />
            <div className="relative glass-card w-full max-w-md p-6 animate-enter">
              <div className="flex items-center justify-between mb-5 border-b pb-3" style={{ borderColor: "var(--border)" }}>
                <div className="flex items-center gap-2">
                  <QrCode size={18} style={{ color: "var(--brand)" }} />
                  <h3 className="font-display font-semibold text-lg" style={{ color: "var(--text-primary)" }}>
                    QR Code Lokasi Bin
                  </h3>
                </div>
                <button onClick={() => { setSelectedBinForQr(null); setCopied(false); }} className="btn-ghost p-1.5">
                  <X size={16} />
                </button>
              </div>

              <div className="flex flex-col items-center text-center space-y-5 py-2">
                <div className="p-3 bg-white rounded-2xl shadow-xl border border-zinc-200">
                  <img src={qrUrl} alt="QR Code Lokasi" width={180} height={180} className="rounded" />
                </div>

                <div className="space-y-1">
                  <h4 className="font-display font-semibold text-base" style={{ color: "var(--text-primary)" }}>
                    {selectedBinForQr.location}
                  </h4>
                  <p className="text-xs px-2" style={{ color: "var(--text-muted)" }}>
                    {selectedBinForQr.address}
                  </p>
                </div>

                {/* Copy link box */}
                <div className="w-full p-2.5 rounded-xl bg-black/25 border flex items-center justify-between gap-3" style={{ borderColor: "var(--border)" }}>
                  <span className="font-mono text-xs truncate flex-1 text-left" style={{ color: "var(--text-muted)" }}>
                    {binLink}
                  </span>
                  <button onClick={() => handleCopyLink(selectedBinForQr.id)} className="btn-primary py-1 px-3 text-xs flex-shrink-0"
                    style={{ background: copied ? "var(--brand-dim)" : "var(--brand)", color: copied ? "var(--brand)" : "#052e16" }}>
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                    {copied ? "Disalin!" : "Salin Link"}
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-4 mt-2 border-t" style={{ borderColor: "var(--border)" }}>
                <button onClick={() => handlePrintQr(selectedBinForQr)} className="btn-primary flex-1 justify-center py-2.5">
                  <Printer size={15} /> Cetak QR Code
                </button>
                <button onClick={() => { setSelectedBinForQr(null); setCopied(false); }} className="btn-secondary flex-1 justify-center py-2.5">
                  Tutup
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
