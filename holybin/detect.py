# detect.py - Holy Bin (Mode Trigger Tombol)
#
# Cara pakai:
#   1. Edit SERIAL_PORT sesuai port ESP32 kamu (atau "DUMMY" untuk test tanpa ESP32)
#   2. python detect.py
#   3. Arahkan webcam ke objek
#   4. Tekan SPASI untuk foto + klasifikasi + sortir
#   5. Tekan Q untuk keluar
#
# Dependency:
#   pip install ultralytics opencv-python pyserial

import os
import cv2
import time
import serial
from ultralytics import YOLO
from serial_port import detect_serial_port

# ============================================================
# KONFIGURASI
# ============================================================

# Pilih model lewat env HOLYBIN_MODEL (default best.pt).
#   contoh: HOLYBIN_MODEL=best1_clean.pt python3 detect.py
MODEL_PATH = os.getenv("HOLYBIN_MODEL", "best.pt")

# Port ESP32: auto-detect (Linux /dev/ttyUSB*, Mac /dev/cu.*, Win COMx).
# Override dengan env HOLYBIN_SERIAL_PORT=... atau "DUMMY" untuk test tanpa ESP32.
SERIAL_PORT = detect_serial_port()
BAUD_RATE   = 115200

# Kamera deteksi sampah = kamera EXTERNAL (path by-id agar stabil walau dicolok-cabut).
# Override dengan env HOLYBIN_CAMERA=<path atau angka indeks>.
CAMERA_DEVICE = os.getenv(
    "HOLYBIN_CAMERA",
    "/dev/v4l/by-id/usb-BC-240717-PZJ_USB_Camera-video-index0",
)
# Kalau diisi angka (mis. "2") perlakukan sebagai indeks; selain itu sebagai path device.
CAMERA_INDEX = int(CAMERA_DEVICE) if CAMERA_DEVICE.lstrip("-").isdigit() else CAMERA_DEVICE

# Mapping class YOLO -> kategori sortir
# Nama class HARUS PERSIS sama dengan output model (case-sensitive)
# Kategori dibandingkan dalam HURUF BESAR (case-insensitive) supaya cocok untuk
# semua model: best.pt/best1 (CARDBOARD, ...) maupun best2 (cardboard, ..., trash).
KATEGORI_PULUNG = {"PAPER", "PLASTIC", "CARDBOARD", "GLASS", "METAL"}  # -> L (kiri)
KATEGORI_BUANG  = {"BIODEGRADABLE", "TRASH"}                           # -> R (kanan)

# Tuning
CONF_THRESHOLD       = 0.65   # confidence minimum; turunkan kalau jarang ke-trigger
DURASI_TAMPIL_HASIL  = 2.5    # detik - berapa lama hasil di-freeze di layar setelah foto

# ============================================================
# Setup
# ============================================================

print("[INIT] Loading YOLO model...")
model = YOLO(MODEL_PATH)
print(f"[INIT] Model loaded. Classes: {model.names}")

print(f"[INIT] Opening serial {SERIAL_PORT}...")
ser = None
if SERIAL_PORT != "DUMMY":
    try:
        # PENTING: dtr/rts = False supaya buka port TIDAK me-reset ESP32.
        # main.py yang sudah jalan di ESP32 tetap hidup saat kita connect.
        ser = serial.Serial()
        ser.port     = SERIAL_PORT
        ser.baudrate = BAUD_RATE
        ser.timeout  = 1
        ser.dtr      = False
        ser.rts      = False
        ser.open()
        time.sleep(0.5)
        ser.reset_input_buffer()

        # Handshake: kirim 'P', ESP32 harusnya balas 'OK'
        ser.write(b"P\n")
        time.sleep(0.5)
        resp = ser.read(ser.in_waiting or 1).decode(errors="replace")
        if "OK" in resp:
            print("[INIT] Serial connected. ESP32 menjawab handshake (OK). OK")
        else:
            print(f"[WARN] Serial terbuka tapi handshake belum jelas. Respon: {resp!r}")
            print("[WARN] Pastikan main.py SUDAH jalan di ESP32 (upload + reset dulu).")
    except Exception as e:
        print(f"[WARN] Gagal buka serial: {e}")
        print("[WARN] Lanjut tanpa ESP32 (mode dry-run).")
        ser = None
else:
    print("[INIT] Mode DUMMY - tidak konek ke ESP32.")

print(f"[INIT] Opening camera {CAMERA_INDEX}...")
# Path device (string) butuh backend V4L2 eksplisit; indeks angka pakai default.
cap = cv2.VideoCapture(CAMERA_INDEX, cv2.CAP_V4L2) if isinstance(CAMERA_INDEX, str) \
      else cv2.VideoCapture(CAMERA_INDEX)
if not cap.isOpened():
    raise RuntimeError(f"Kamera ga kebuka: {CAMERA_INDEX}. Cek HOLYBIN_CAMERA / koneksi kamera external.")


# ============================================================
# Helper
# ============================================================

def kirim_perintah(cmd):
    """Kirim L/R/C ke ESP32"""
    if ser is None:
        print(f"[DRY] Would send: {cmd}")
        return
    try:
        ser.write(f"{cmd}\n".encode())
        print(f"[SERIAL] Sent: {cmd}")
    except Exception as e:
        print(f"[ERROR] Gagal kirim: {e}")


def klasifikasi_kategori(nama_class):
    """Map nama class YOLO ke 'L' (pulung) / 'R' (buang) / None. Case-insensitive."""
    nama = nama_class.upper()
    if nama in KATEGORI_PULUNG:
        return 'L'
    if nama in KATEGORI_BUANG:
        return 'R'
    return None


def deteksi_terbaik(frame):
    """Jalankan YOLO sekali, return (nama_class, conf, bbox) atau None"""
    results = model(frame, verbose=False, conf=0.1)  # threshold rendah dulu, filter manual

    best = None
    best_conf = 0
    for r in results:
        if r.boxes is None:
            continue
        for box in r.boxes:
            conf = float(box.conf[0])
            if conf > best_conf:
                best_conf = conf
                cls_id = int(box.cls[0])
                best = (model.names[cls_id], conf, box.xyxy[0].tolist())
    return best


def gambar_hasil(frame, det, kategori, status_text):
    """Gambar bounding box + label + status di frame"""
    if det is not None:
        nama, conf, bbox = det
        x1, y1, x2, y2 = map(int, bbox)
        # warna: hijau = pulung, merah = buang, abu-abu = unknown
        if kategori == 'L':
            warna = (0, 255, 0)
        elif kategori == 'R':
            warna = (0, 100, 255)
        else:
            warna = (180, 180, 180)
        cv2.rectangle(frame, (x1, y1), (x2, y2), warna, 3)
        label = f"{nama} {conf:.2f}"
        cv2.putText(frame, label, (x1, max(y1 - 10, 20)),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, warna, 2)

    # Status bar besar di atas
    h, w = frame.shape[:2]
    cv2.rectangle(frame, (0, 0), (w, 50), (0, 0, 0), -1)
    cv2.putText(frame, status_text, (10, 32),
               cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)
    return frame


def gambar_preview(frame):
    """Overlay instruksi di mode preview (live webcam, tanpa deteksi)"""
    h, w = frame.shape[:2]
    cv2.rectangle(frame, (0, 0), (w, 50), (0, 0, 0), -1)
    cv2.putText(frame, "Tekan [SPASI] untuk foto & sortir   |   [Q] keluar",
               (10, 32), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
    return frame


# ============================================================
# State machine: PREVIEW <-> RESULT
# ============================================================

STATE_PREVIEW = "preview"
STATE_RESULT  = "result"

state = STATE_PREVIEW
result_frame = None      # frozen frame saat di state RESULT
result_until = 0         # timestamp kapan keluar dari state RESULT

print("\n[RUN] Tekan SPASI untuk foto, Q untuk keluar.\n")

try:
    while True:
        ret, frame = cap.read()
        if not ret:
            print("[ERROR] Frame gagal dibaca.")
            break

        if state == STATE_PREVIEW:
            # Tampilkan webcam live, tanpa inference (hemat resource)
            display = gambar_preview(frame.copy())
            cv2.imshow("Holy Bin - Trigger Mode", display)

            key = cv2.waitKey(1) & 0xFF

            if key == ord(' '):
                # ===== USER TEKAN SPASI =====
                print("\n[TRIGGER] Mengambil foto & klasifikasi...")

                # Ambil snapshot
                snapshot = frame.copy()

                # Jalankan YOLO
                det = deteksi_terbaik(snapshot)

                if det is None:
                    # Ga ada objek sama sekali
                    print("  -> Tidak ada objek terdeteksi.")
                    print("  -> Default: kirim R (tidak bisa dipulung) demi keamanan.")
                    kirim_perintah('R')
                    status_text = "TIDAK ADA OBJEK -> Sortir KANAN (default aman)"
                    kategori = 'R'

                elif det[1] < CONF_THRESHOLD:
                    # Ada objek tapi conf rendah
                    nama, conf, _ = det
                    print(f"  -> Terdeteksi {nama} tapi conf rendah ({conf:.2f} < {CONF_THRESHOLD}).")
                    print("  -> Default: kirim R (tidak bisa dipulung) demi keamanan.")
                    kirim_perintah('R')
                    status_text = f"CONF RENDAH ({conf:.2f}) -> Sortir KANAN (default aman)"
                    kategori = 'R'

                else:
                    # Confidence cukup tinggi, klasifikasi normal
                    nama, conf, _ = det
                    kategori = klasifikasi_kategori(nama)

                    if kategori == 'L':
                        label = "BISA DIPULUNG (KIRI)"
                    elif kategori == 'R':
                        label = "TIDAK BISA DIPULUNG (KANAN)"
                    else:
                        # class tidak masuk mapping (harusnya ga kejadian)
                        print(f"  -> Class '{nama}' tidak ada di mapping. Default R.")
                        kategori = 'R'
                        label = "UNKNOWN -> KANAN (default aman)"

                    print(f"  -> {nama} ({conf:.2f}) -> {label}")
                    kirim_perintah(kategori)
                    status_text = f"{nama} {conf:.2f} -> {label}"

                # Pindah ke state RESULT (freeze tampilan beberapa detik)
                result_frame = gambar_hasil(snapshot, det, kategori, status_text)
                result_until = time.time() + DURASI_TAMPIL_HASIL
                state = STATE_RESULT

            elif key == ord('q'):
                break

        elif state == STATE_RESULT:
            # Tampilkan hasil yang dibekukan
            cv2.imshow("Holy Bin - Trigger Mode", result_frame)
            key = cv2.waitKey(1) & 0xFF

            if time.time() >= result_until:
                # Kembali ke preview
                state = STATE_PREVIEW
                result_frame = None
                print("\n[READY] Siap untuk objek berikutnya.\n")

            elif key == ord('q'):
                break

except KeyboardInterrupt:
    print("\n[STOP] Interrupted.")

finally:
    cap.release()
    cv2.destroyAllWindows()
    if ser is not None:
        kirim_perintah('C')  # balik tengah sebelum keluar
        time.sleep(0.3)
        ser.close()
    print("[STOP] Cleanup done.")