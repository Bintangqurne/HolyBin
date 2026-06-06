# Panduan Menjalankan HolyBin

Urutan perintah terminal untuk memulai aplikasi dari nol.
Folder project: `~/Codingan/smart-trash-system`

---

## 0. Persiapan hardware (cek tiap kali mulai)

```bash
# 1. Colok ESP32 (kabel DATA, bukan charge-only) -> harus muncul /dev/ttyUSB0
ls /dev/ttyUSB*

# 2. Beri izin akses port serial (ulangi tiap ESP32 dicabut/colok ulang)
sudo chmod a+rw /dev/ttyUSB0

# 3. Colok kamera: bawaan laptop (QR) + external/tong (deteksi sampah)
ls /dev/v4l/by-id/        # harus ada Sonix (bawaan) & BC USB Camera (external)
```

> Agar izin port permanen (tak perlu chmod terus): `sudo usermod -aG dialout $USER` lalu **logout-login**.

---

## 1. Menyalakan aplikasi — buka 3 terminal

Semua perintah dijalankan dari folder project. Awali tiap terminal dengan:
```bash
cd ~/Codingan/smart-trash-system
```

### Terminal 1 — Backend (Next.js + Firebase)
Untuk mencatat absen & dashboard. **Wajib untuk mode QR.**
```bash
npm run dev
```
Tunggu sampai muncul `✓ Ready`. Backend di **http://localhost:3000**.

### Terminal 2 — Gateway servo (ESP32)
Jembatan HTTP → serial ESP32. **Wajib untuk semua gerakan servo.**
```bash
cd holybin
python3 api_server.py
```
Pastikan muncul `[INIT] Serial terhubung ke ESP32.`
Kalau muncul `mode DUMMY` → port belum bisa diakses; ulangi `sudo chmod a+rw /dev/ttyUSB0`
lalu **restart** perintah ini.

### Terminal 3 — Aplikasi kamera (pilih salah satu mode)

**a) Mode QR (absen + buka pintu)** — kamera bawaan:
```bash
cd scanner
python3 scanner.py
```

**b) Mode SAMPAH (deteksi + sortir)** — kamera external:
```bash
cd holybin
python3 detect.py
```

**c) Aplikasi gabungan (bisa switch 2 mode dengan tombol/`S`):**
```bash
cd holybin
python3 app.py
```

---

## 2. Mode mana butuh apa?

| Mode | Terminal 1 (backend) | Terminal 2 (api_server) | Hardware |
|------|:--:|:--:|---|
| **QR (absen + pintu)** | ✅ wajib | ✅ wajib | kamera bawaan + ESP32 |
| **SAMPAH (sortir)** | ❌ tidak | ✅ wajib | kamera external + ESP32 |

> Mode SAMPAH **tidak** butuh `npm run dev`. Mode QR butuh keduanya.

---

## 3. Cek semuanya sehat

```bash
curl -s http://localhost:3000 -o /dev/null -w "backend: %{http_code}\n"   # harus 200
curl -s http://localhost:5000/ping                                         # serial harus /dev/ttyUSB0, bukan DUMMY
```

Tes servo cepat tanpa kamera:
```bash
cd holybin
python3 test_servo_api.py            # tes semua servo
python3 test_servo_api.py sortir     # cuma servo sortir
```

---

## 4. Masalah umum

| Gejala | Sebab & solusi |
|---|---|
| `/ping` → `"serial":"DUMMY"` | ESP32 belum siap saat api_server start. `sudo chmod a+rw /dev/ttyUSB0` → **restart** api_server. |
| `Address already in use` (port 5000) | Sudah ada api_server jalan: `fuser -k 5000/tcp` lalu jalankan lagi. |
| Port 3000 dipakai | `fuser -k 3000/tcp` lalu `npm run dev`. |
| Scan QR tapi servo diam | Kemungkinan status `info` (sudah absen / cooldown). Petugas yang sama hanya memicu kunci sekali per `COOLDOWN_MINUTES` (di `.env.local`). |
| Servo sortir gerak, kunci tidak | Pastikan firmware ESP32 versi yang paham `2O/2C/3O/3C` sudah di-upload (lihat bagian Firmware). |
| Kamera salah/tidak terbuka | Cek `ls /dev/v4l/by-id/`, sesuaikan `CAMERA_INDEX` di `scanner/.env` atau `HOLYBIN_CAMERA` untuk detect/app. |

---

## 5. Firmware ESP32 (hanya saat `main.py` berubah)

Upload firmware terbaru ke board lalu reset (bebaskan port dulu: stop api_server & MicroPico):
```bash
cd holybin
python3 -m mpremote connect /dev/ttyUSB0 cp main.py :main.py
python3 -m mpremote connect /dev/ttyUSB0 reset
```

---

## 6. Mematikan

Tekan `Q` di jendela kamera, lalu `Ctrl+C` di tiap terminal. Atau paksa:
```bash
fuser -k 3000/tcp    # backend
fuser -k 5000/tcp    # api_server
```

---

## 7. Setup awal (sekali saja, kalau di mesin baru)

```bash
# Backend
npm install

# Python (scanner + holybin) — pakai python3 sistem
pip3 install --user opencv-python pyzbar requests python-dotenv flask pyserial numpy
sudo apt install -y libzbar0           # dibutuhkan pyzbar

# Untuk mode SAMPAH (YOLO)
pip3 install --user ultralytics
# (torch + torchvision sudah terpasang; kalau belum, pakai index cu121 milik PyTorch)

# (Opsional) suara feedback scanner
pip3 install --user simpleaudio
```

Juga isi konfigurasi:
- `scanner/.env` — BIN_CODE, API_BASE_URL, SCANNER_API_TOKEN, CAMERA_INDEX
- `.env.local` — kredensial Firebase + SCANNER_API_TOKEN (harus sama dgn scanner) + COOLDOWN_MINUTES
