# TrashSync QR Scanner (Python)

Scanner Python yang dijalankan di setiap stasiun bin. Membaca QR milik petugas via kamera, lalu mengirim absensi otomatis ke backend.

## Cara Kerja

1. Petugas menunjukkan kartu QR pribadi (berisi `userCode`) ke kamera.
2. Script decode QR → POST `{ userCode, binCode }` ke `/api/attendance`.
3. Backend cek userCode + binCode di Firestore → simpan record absensi.
4. Layar scanner menampilkan feedback (hijau = berhasil, merah = gagal).

## Setup

### 1. Install dependensi sistem

**Raspberry Pi / Ubuntu / Debian:**
```bash
sudo apt-get update
sudo apt-get install -y libzbar0 python3-pip
```

**macOS:**
```bash
brew install zbar
```

### 2. Install Python packages
```bash
cd scanner/
pip install -r requirements.txt
```

### 3. Konfigurasi
```bash
cp .env.example .env
```

Edit `.env` dan isi:
- `BIN_CODE` — ambil dari dashboard admin > **Kelola Bin** (kode format `B-XXXX`)
- `API_BASE_URL` — URL deploy aplikasi (contoh: `https://holybin.vercel.app`)
- `SCANNER_API_TOKEN` — harus **sama persis** dengan `SCANNER_API_TOKEN` di `.env.local` backend

### 4. Jalankan
```bash
python scanner.py
```

Tekan **Q** di jendela kamera untuk berhenti.

## Konfigurasi Environment

| Variable | Wajib | Default | Keterangan |
|---|---|---|---|
| `BIN_CODE` | Ya | — | Kode bin lokasi ini (e.g. `B-7K2A`) |
| `API_BASE_URL` | Ya | — | URL backend tanpa trailing slash |
| `SCANNER_API_TOKEN` | Ya | — | Shared secret validasi request |
| `COOLDOWN_SECONDS` | Tidak | `5` | Jeda minimum scan ulang QR yang sama |
| `CAMERA_INDEX` | Tidak | `0` | Index kamera OpenCV |

## Menjalankan Otomatis saat Boot (systemd)

Buat file `/etc/systemd/system/trashsync-scanner.service`:

```ini
[Unit]
Description=TrashSync QR Scanner
After=network.target

[Service]
User=pi
WorkingDirectory=/home/pi/smart-trash-system/scanner
ExecStart=/usr/bin/python3 /home/pi/smart-trash-system/scanner/scanner.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Aktifkan:
```bash
sudo systemctl enable trashsync-scanner
sudo systemctl start trashsync-scanner
```

## Menjalankan Tanpa Layar (headless)

Jika Raspberry Pi tanpa monitor, gunakan mode headless dengan menonaktifkan tampilan OpenCV:
```bash
# Tambahkan ke .env:
DISPLAY=:0  # atau gunakan virtual display dengan Xvfb
```

Atau modifikasi `scanner.py` untuk hapus `cv2.imshow(...)` dan `cv2.waitKey(...)` jika hanya butuh log terminal.
