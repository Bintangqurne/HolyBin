# Konteks Project — HolyBin / TrashSync (Smart Trash System)

> Dokumen ini ditulis sebagai **konteks untuk prompt AI**. Paste seluruh isi ini ke ChatGPT/Claude/dll
> lalu lanjutkan dengan permintaanmu (mis. "buatkan latar belakang", "buat slide", "tulis bab metodologi", dst).

---

## 1. Ringkasan Singkat

**HolyBin** (di sisi web disebut **TrashSync**) adalah **sistem tempat sampah pintar** yang menggabungkan:

1. **Pemilahan sampah otomatis berbasis AI/computer vision** — kamera + model YOLO mengklasifikasikan sampah, lalu servo menyortirnya ke kompartemen yang benar.
2. **Pemberdayaan pemulung & petugas kebersihan** — kompartemen sampah punya **pintu terkunci terpisah** yang hanya bisa dibuka oleh petugas berwenang lewat **scan QR** (sekaligus berfungsi sebagai absensi).
3. **Dashboard web + database cloud** — admin memantau lokasi tong, petugas, dan riwayat absensi/pengambilan secara real-time.

**Inti inovasi:** memilah sampah dari sumber (bukan di TPA) **dan** menghubungkan sampah layak-daur-ulang langsung ke pemulung melalui akses yang terstruktur, aman, dan tercatat secara digital.

---

## 2. Masalah yang Diselesaikan

- Timbulan sampah Indonesia tinggi, sebagian besar **tidak terpilah dari sumbernya** → sampah bernilai (plastik, kertas, logam, kaca) ikut tercampur & berakhir di TPA.
- Sebagian besar solusi "smart bin" hanya fokus pada **pemilahan otomatis, monitoring volume, dan edukasi**.
- **Peran pemulung (sektor informal)** yang menyumbang besar pada daur ulang **belum terintegrasi** ke dalam sistem digital.
- HolyBin menjembatani: sampah otomatis dipilah, lalu disalurkan ke pemulung lewat kompartemen khusus yang aksesnya tercatat.

---

## 3. Cara Kerja (Alur Utama)

### Mode SAMPAH (pemilahan otomatis)
1. Pengguna menaruh sampah di depan kamera external (di tong).
2. Tekan SPASI → kamera memotret → model **YOLO** mengklasifikasi objek.
3. Hasil klasifikasi dipetakan ke 2 kategori:
   - **Bisa dipulung / recyclable** → `PAPER, PLASTIC, CARDBOARD, GLASS, METAL` → servo sortir ke **KIRI (L)**.
   - **Tidak bisa dipulung / residu** → `BIODEGRADABLE, TRASH` → servo sortir ke **KANAN (R)**.
   - Objek tak jelas / confidence rendah (< 0.65) → default **KANAN (R)** demi keamanan.

### Mode QR (absensi + buka pintu)
1. Petugas (pemulung / petugas kebersihan) menyodorkan **kartu QR pribadi** ke kamera bawaan laptop.
2. Scanner men-decode `userCode` (format `U-XXXX`), lalu POST ke backend `/api/attendance`.
3. Backend memvalidasi petugas & tong, mencatat **absensi**, dan mengembalikan `role` petugas.
4. Berdasarkan role, **pintu kompartemen terkait dibuka** (toggle: scan = buka, scan lagi = tutup):
   - `pemulung` → **servo 2** (kompartemen recyclable).
   - `kebersihan` → **servo 3** (kompartemen residu).
5. Ada **cooldown** agar petugas yang sama tidak memicu berulang dalam waktu singkat.
6. Jika offline, absensi disimpan lokal (SQLite) lalu disinkronkan otomatis saat online.

---

## 4. Arsitektur (3 Lapis)

```
┌─────────────────────────────────────────────────────────────┐
│  LAPIS 1 — HARDWARE (ESP32 + MicroPython)                    │
│  main.py auto-run di ESP32. Menerima perintah via USB serial:│
│   • Servo 1 (pin 13) = SORTIR sampah (L/R/C, auto balik)     │
│   • Servo 2 (pin 32) = KUNCI pintu pemulung (2O/2C, ditahan) │
│   • Servo 3 (pin 27) = KUNCI pintu kebersihan (3O/3C)        │
│   • Sensor LDR (pin 34) = baca kondisi cahaya                │
└─────────────────────────────────────────────────────────────┘
                         ▲ USB Serial (115200 baud)
┌─────────────────────────────────────────────────────────────┐
│  LAPIS 2 — EDGE / PYTHON (di laptop/Raspberry Pi di lokasi)  │
│   • api_server.py  : gateway HTTP→serial (Flask, port 5000)  │
│   • detect.py      : mode SAMPAH (YOLO + sortir)             │
│   • scanner/scanner.py : mode QR (absen + buka pintu)        │
│   • app.py         : aplikasi GABUNGAN 2 mode (switch S/TAB) │
└─────────────────────────────────────────────────────────────┘
                         ▲ HTTP REST + token
┌─────────────────────────────────────────────────────────────┐
│  LAPIS 3 — BACKEND WEB (Next.js 14 + Firebase, Vercel)       │
│   • Dashboard admin, kelola bin & petugas, riwayat absensi   │
│   • API: /api/attendance, /api/heartbeat                     │
│   • Firestore (database) + Firebase Auth (login admin)       │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Tech Stack

| Lapis | Teknologi |
|------|-----------|
| Hardware | ESP32, MicroPython, 3× servo, sensor LDR |
| Computer Vision | Python, OpenCV, **Ultralytics YOLO** (model `best.pt`, `best1.pt`, `best2.pt`) |
| QR | pyzbar (decode QR), simpleaudio (feedback suara) |
| Gateway | Flask (HTTP→serial), pyserial |
| Edge offline | SQLite (`queue.db`) untuk antrian absensi offline |
| Web frontend | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Recharts, lucide-react |
| Backend/DB | Firebase (Firestore + Auth), firebase-admin |
| Deploy | Vercel (web), perangkat edge per lokasi tong |

---

## 6. Model Data (Firestore)

| Koleksi | Isi |
|---------|-----|
| `admins` | Akun admin dashboard (uid, email, role: admin/superadmin) |
| `users` | Petugas lapangan. `userCode` (mis. `U-9M3X`) = isi QR kartu. Punya `role` (pemulung/kebersihan), `isActive` |
| `bins` | Lokasi tong fisik. `code` (mis. `B-7K2A`) dikonfigurasi di `scanner/.env` perangkat lokasi |
| `attendances` | Catatan tiap scan QR: relasi ke user & bin + field denormalisasi (userName, binLocation, scannedAt) |

**Relasi:** `users 1—* attendances`, `bins 1—* attendances`.

> Catatan: README & script awal menyebut koleksi `codes`/`pickups` (konsep awal "kode pengambilan").
> Versi terkini memakai `users` + `attendances` (absensi berbasis QR petugas). ERD = sumber kebenaran terbaru.

---

## 7. Peta File Penting

```
smart-trash-system/
├── app/                       # Next.js (frontend + API)
│   ├── page.tsx               # landing
│   ├── login/                 # login admin
│   ├── dashboard/             # dashboard, bins, users, analytics
│   ├── history/               # riwayat absensi
│   └── api/
│       ├── attendance/route.ts   # catat absensi (dipanggil scanner)
│       └── heartbeat/route.ts    # status hidup tong
├── services/                  # logika data (user, attendance, auth, pickup)
├── types/                     # tipe TypeScript
├── lib/firebase.ts            # init Firebase client
├── lib/generateCode.ts        # generator kode unik
│
├── holybin/                   # sisi hardware + edge
│   ├── main.py                # firmware ESP32 (MicroPython, auto-run)
│   ├── api_server.py          # gateway HTTP→serial (Flask :5000)
│   ├── detect.py              # mode SAMPAH (YOLO + sortir)
│   ├── app.py                 # aplikasi gabungan QR + SAMPAH
│   ├── serial_port.py         # auto-deteksi port ESP32
│   ├── best*.pt               # model YOLO terlatih
│   └── test_servo*.py         # utilitas tes servo
│
├── scanner/                   # mode QR (terpisah)
│   ├── scanner.py             # scan QR → absen → buka pintu
│   ├── config.py / .env       # BIN_CODE, API_BASE_URL, token, kamera
│   ├── scan_queue.py          # antrian offline (SQLite)
│   └── sounds.py              # feedback suara
│
├── ERD.md                     # diagram & penjelasan database
├── README.md                  # setup Next.js + Firebase
└── PANDUAN.md                 # cara menjalankan end-to-end
```

---

## 8. Protokol Serial ESP32 (referensi)

Dikirim dari laptop ke ESP32 via USB (akhiri `\n`):

| Perintah | Aksi |
|----------|------|
| `L` / `R` / `C` | Servo 1 sortir KIRI / KANAN / TENGAH (auto balik tengah) |
| `2O` / `2C` | Servo 2: buka / tutup kunci pintu **pemulung** (ditahan) |
| `3O` / `3C` | Servo 3: buka / tutup kunci pintu **kebersihan** (ditahan) |
| `P` | Ping handshake (ESP32 balas `OK`) |

API gateway (`api_server.py`, port 5000):
`POST /servo/<L|R|C>`, `POST /lock/<pemulung|kebersihan>` (toggle), `POST /lock/<role>/<open|close>`, `GET /ping`.

---

## 9. Klasifikasi Sampah (mapping YOLO)

- **KATEGORI_PULUNG** (recyclable → servo KIRI): `PAPER, PLASTIC, CARDBOARD, GLASS, METAL`
- **KATEGORI_BUANG** (residu → servo KANAN): `BIODEGRADABLE, TRASH`
- Threshold confidence: **0.65**. Di bawah itu / tak terdeteksi → default KANAN (aman).
- Perbandingan case-insensitive agar cocok lintas model (`best.pt`/`best1` vs `best2`).

---

## 10. Status & Catatan

- Mode SAMPAH **tidak** butuh backend web; mode QR butuh backend (Next.js) + gateway servo.
- Mendukung 2 kamera: bawaan laptop (QR) + external (deteksi sampah).
- Ada beberapa varian model YOLO (`best1.pt`, `best1_clean.pt`, `best2.pt`) untuk eksperimen akurasi.
- Mendukung operasi offline (antrian absensi lokal) dengan retry otomatis.
```
