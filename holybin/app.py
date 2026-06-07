"""
HolyBin - Aplikasi Kamera Terpadu (2 mode + tombol switch)
==========================================================
Satu jendela kamera dengan tombol untuk berganti mode:

  • Mode QR     : kamera BAWAAN laptop  -> absen (Firebase) + buka pintu (servo 2)
  • Mode SAMPAH : kamera EXTERNAL (tong) -> deteksi YOLO + sortir (servo 1)

Ganti mode : klik kotak [SWITCH] di pojok kanan-atas, atau tekan  S  /  TAB
Klasifikasi: (mode SAMPAH) tekan  SPASI  untuk foto + sortir
Berhenti   : tekan  Q

Perintah servo dikirim lewat HTTP ke api_server.py (gateway serial ESP32),
jadi JALANKAN api_server.py lebih dulu:  python3 api_server.py

Dependency: opencv-python, pyzbar, requests, python-dotenv, ultralytics, numpy
"""

import os
import sys
import time
import threading

import cv2
import numpy as np
import requests
from pyzbar.pyzbar import decode, ZBarSymbol

# ---------------------------------------------------------------------------
# Muat config + helper milik scanner (dipakai ulang, bukan diduplikasi)
# ---------------------------------------------------------------------------
from dotenv import load_dotenv

HOLYBIN_DIR = os.path.dirname(os.path.abspath(__file__))
SCANNER_DIR = os.path.abspath(os.path.join(HOLYBIN_DIR, "..", "scanner"))

# Muat scanner/.env DULU agar variabel wajib (BIN_CODE, dll) tersedia
load_dotenv(os.path.join(SCANNER_DIR, ".env"))
sys.path.insert(0, SCANNER_DIR)

import config            # noqa: E402  (BIN_CODE, API_BASE_URL, kamera, dst.)
import sounds            # noqa: E402
import scan_queue as offline_queue  # noqa: E402

# ---------------------------------------------------------------------------
# Konfigurasi
# ---------------------------------------------------------------------------
WINDOW_NAME = "HolyBin"

# Kamera tiap mode (boleh angka indeks atau path device by-id).
CAMERA_QR = os.getenv("CAMERA_QR", str(config.CAMERA_INDEX))   # kamera bawaan
CAMERA_TRASH = os.getenv(
    "CAMERA_TRASH",
    "/dev/v4l/by-id/usb-BC-240717-PZJ_USB_Camera-video-index0",  # kamera external
)

# Gateway servo (api_server.py) & backend absen
SERVO_URL = config.HOLYBIN_API_URL                      # mis. http://localhost:5000
ATTENDANCE_URL = f"{config.API_BASE_URL}/api/attendance"
HEADERS = {"Content-Type": "application/json", "X-Scanner-Token": config.SCANNER_TOKEN}

# YOLO (deteksi sampah). Pilih model lewat env HOLYBIN_MODEL (default best.pt).
#   contoh: HOLYBIN_MODEL=best1_clean.pt python3 app.py
_model_env = os.getenv("HOLYBIN_MODEL", "best.pt")
MODEL_PATH = _model_env if os.path.isabs(_model_env) else os.path.join(HOLYBIN_DIR, _model_env)
# Dibandingkan HURUF BESAR (case-insensitive) -> cocok untuk best.pt/best1
# (CARDBOARD, ...) maupun best2 (cardboard, ..., trash).
KATEGORI_PULUNG = {"PAPER", "PLASTIC", "CARDBOARD", "GLASS", "METAL"}  # -> L (kiri)  servo 1
KATEGORI_BUANG = {"BIODEGRADABLE", "TRASH"}                            # -> R (kanan) servo 1
CONF_THRESHOLD = 0.65
DURASI_HASIL = 2.5

# Warna (BGR)
COLOR_IDLE = (160, 160, 160)
COLOR_DETECT = (0, 220, 220)
COLOR_SUCCESS = (0, 220, 120)
COLOR_INFO = (240, 180, 50)
COLOR_OFFLINE = (100, 160, 240)
COLOR_ERROR = (50, 80, 240)
COLOR_BTN = (90, 90, 90)

# ---------------------------------------------------------------------------
# State global
# ---------------------------------------------------------------------------
mode = "qr"                       # "qr" | "trash"
switch_requested = False          # diset oleh klik mouse
button_rect = (0, 0, 0, 0)        # (x1,y1,x2,y2) tombol switch, di-update tiap frame
last_seen: dict[str, float] = {}  # debounce QR
feedback = {"text": "", "color": COLOR_IDLE, "until": 0.0}

# lazy-load model: cuma dibuka saat pertama masuk mode SAMPAH
_model = None


def get_model():
    global _model
    if _model is None:
        from ultralytics import YOLO
        print("[INIT] Memuat model YOLO...")
        _model = YOLO(MODEL_PATH)
        print(f"[INIT] Model siap. Kelas: {_model.names}")
    return _model


# ---------------------------------------------------------------------------
# Kamera
# ---------------------------------------------------------------------------
def open_camera(dev, hi_res=False):
    """Buka kamera dari angka indeks atau path device."""
    if isinstance(dev, str) and not dev.lstrip("-").isdigit():
        cap = cv2.VideoCapture(dev, cv2.CAP_V4L2)
    else:
        cap = cv2.VideoCapture(int(dev))
    if hi_res:
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
        cap.set(cv2.CAP_PROP_FPS, 30)
    return cap


# ---------------------------------------------------------------------------
# Servo via HTTP (api_server.py)
# ---------------------------------------------------------------------------
def trigger_servo(role: str) -> None:
    """Mode QR: toggle kunci kompartemen sesuai role lewat /lock/<role>. Non-blocking.
    pemulung -> servo 2, kebersihan -> servo 3. Fire-and-forget di daemon thread."""
    if not config.SERVO_ENABLED:
        return
    if role not in ("pemulung", "kebersihan"):
        print(f"  [servo] role tidak dikenal: {role!r}, kunci tidak digerakkan.")
        return

    def _send():
        try:
            requests.post(f"{SERVO_URL}/lock/{role}", headers=HEADERS, timeout=3)
        except Exception as e:
            print(f"  [servo] gagal kirim ke holybin: {e}")
    threading.Thread(target=_send, daemon=True).start()


def sortir_servo(cmd):
    """Mode SAMPAH: gerakkan servo 1 (L/R/C) lewat /servo/<cmd>."""
    try:
        requests.post(f"{SERVO_URL}/servo/{cmd}", headers=HEADERS, timeout=3)
        print(f"  [servo] sortir -> {cmd}")
    except Exception as e:
        print(f"  [servo] gagal sortir: {e}")


# ---------------------------------------------------------------------------
# Absen (mode QR) — pola sama dengan scanner.py
# ---------------------------------------------------------------------------
def post_attendance(user_code: str, scanned_at: float | None = None) -> tuple[str, str, str | None]:
    """Return (status, message, role). role: 'pemulung' | 'kebersihan' | None."""
    payload = {"userCode": user_code, "binCode": config.BIN_CODE}
    if scanned_at:
        import datetime
        payload["scannedAt"] = datetime.datetime.utcfromtimestamp(scanned_at).isoformat() + "Z"
    try:
        r = requests.post(ATTENDANCE_URL, json=payload, headers=HEADERS, timeout=6)
        data = r.json()
        if r.status_code == 200 and data.get("ok"):
            role = data.get("userRole")
            if data.get("alreadyScanned"):
                return "info", f"Sudah absen {data.get('minutesAgo', 0)} menit lalu  —  {data.get('userName','')}", role
            return "ok", f"Absen: {data.get('userName')}  @  {data.get('binLocation')}", role
        return "error", data.get("error", f"HTTP {r.status_code}"), None
    except (requests.exceptions.ConnectionError, requests.exceptions.Timeout):
        ts = scanned_at or time.time()
        offline_queue.enqueue(user_code, config.BIN_CODE, ts)
        return "offline", f"Offline — tersimpan lokal ({offline_queue.pending_count()} antrian)", None
    except Exception as e:
        return "error", str(e), None


def heartbeat_worker():
    url = f"{config.API_BASE_URL}/api/heartbeat"
    while True:
        try:
            requests.post(url, json={"binCode": config.BIN_CODE}, headers=HEADERS, timeout=5)
        except Exception:
            pass
        time.sleep(60)


def retry_worker():
    while True:
        time.sleep(30)
        for item in offline_queue.get_pending():
            status, _, _ = post_attendance(item["user_code"], item["scanned_at"])
            if status in ("ok", "info"):
                offline_queue.mark_synced(item["id"])
            else:
                offline_queue.increment_retry(item["id"])


# ---------------------------------------------------------------------------
# Gambar UI
# ---------------------------------------------------------------------------
def set_feedback(text, color, duration=3.0):
    feedback["text"] = text
    feedback["color"] = color
    feedback["until"] = time.time() + duration


def draw_header(frame):
    h, w = frame.shape[:2]
    cv2.rectangle(frame, (0, 0), (w, 40), (15, 15, 15), -1)
    label = "Mode: QR (absen + pintu)" if mode == "qr" else "Mode: SAMPAH (deteksi + sortir)"
    cv2.putText(frame, f"HolyBin  |  {label}", (12, 26),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 220, 120), 1, cv2.LINE_AA)


def draw_switch_button(frame):
    """Tombol klik di pojok kanan-atas. Update button_rect untuk handler mouse."""
    global button_rect
    h, w = frame.shape[:2]
    bw, bh = 150, 34
    x2, y1 = w - 12, 48
    x1, y2 = x2 - bw, y1 + bh
    button_rect = (x1, y1, x2, y2)
    cv2.rectangle(frame, (x1, y1), (x2, y2), COLOR_BTN, -1)
    cv2.rectangle(frame, (x1, y1), (x2, y2), (220, 220, 220), 1)
    target = "-> SAMPAH" if mode == "qr" else "-> QR"
    cv2.putText(frame, f"SWITCH {target}", (x1 + 10, y1 + 23),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)


def draw_feedback(frame):
    if time.time() < feedback["until"]:
        h, w = frame.shape[:2]
        text, color = feedback["text"], feedback["color"]
        font = cv2.FONT_HERSHEY_SIMPLEX
        (tw, th), _ = cv2.getTextSize(text, font, 0.72, 2)
        x, y = (w - tw) // 2, h - 22
        cv2.rectangle(frame, (0, y - th - 14), (w, h), (15, 15, 15), -1)
        cv2.putText(frame, text, (x, y), font, 0.72, color, 2, cv2.LINE_AA)


def draw_guide_box(frame):
    """Kotak panduan QR di tengah. Return (x1,y1,x2,y2)."""
    h, w = frame.shape[:2]
    size = int(min(w, h) * 0.55)
    cx, cy = w // 2, h // 2
    x1, y1, x2, y2 = cx - size // 2, cy - size // 2, cx + size // 2, cy + size // 2
    for (ax, ay) in ((x1, y1), (x2, y1), (x1, y2), (x2, y2)):
        dx = 28 if ax == x1 else -28
        dy = 28 if ay == y1 else -28
        cv2.line(frame, (ax, ay), (ax + dx, ay), COLOR_DETECT, 3)
        cv2.line(frame, (ax, ay), (ax, ay + dy), COLOR_DETECT, 3)
    return x1, y1, x2, y2


# ---------------------------------------------------------------------------
# Logika tiap mode
# ---------------------------------------------------------------------------
def process_qr(frame):
    gx1, gy1, gx2, gy2 = draw_guide_box(frame)
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (0, 0), 3)
    sharp = cv2.addWeighted(gray, 1.7, blur, -0.7, 0)

    for qr in decode(sharp, symbols=[ZBarSymbol.QRCODE]):
        user_code = qr.data.decode("utf-8").strip()
        pts = qr.polygon
        if len(pts) == 4:
            for j in range(4):
                cv2.line(frame, (pts[j].x, pts[j].y),
                         (pts[(j + 1) % 4].x, pts[(j + 1) % 4].y), COLOR_SUCCESS, 2)

        if not user_code.upper().startswith("U-"):
            set_feedback("Bukan QR petugas", COLOR_ERROR, 2.0)
            continue
        inside = all(gx1 <= p.x <= gx2 and gy1 <= p.y <= gy2 for p in pts)
        if not inside:
            continue
        now = time.time()
        if now - last_seen.get(user_code, 0) < config.COOLDOWN_SECONDS:
            continue
        last_seen[user_code] = now

        print(f"[SCAN] {user_code}  bin={config.BIN_CODE}")
        status, msg, role = post_attendance(user_code)
        print(f"  -> {status.upper()} {msg}  (role={role})")
        if status in config.SERVO_TRIGGER_ON and role:
            trigger_servo(role)   # toggle kunci pintu sesuai role
        color = {"ok": COLOR_SUCCESS, "info": COLOR_INFO,
                 "offline": COLOR_OFFLINE, "error": COLOR_ERROR}.get(status, COLOR_ERROR)
        set_feedback(msg[:65], color, 3.5)
        sounds.play(status)


def classify_trash(frame):
    """Jalankan YOLO sekali, kirim perintah sortir ke servo 1."""
    model = get_model()
    results = model(frame, verbose=False, conf=0.1)
    best, best_conf = None, 0.0
    for r in results:
        for box in (r.boxes or []):
            conf = float(box.conf[0])
            if conf > best_conf:
                best_conf = conf
                best = (model.names[int(box.cls[0])], conf)

    if best is None or best[1] < CONF_THRESHOLD:
        sortir_servo("R")   # default aman: buang
        set_feedback("Objek tak jelas -> sortir KANAN (default)", COLOR_INFO, DURASI_HASIL)
        sounds.play("info")
        return

    nama, conf = best
    if nama.upper() in KATEGORI_PULUNG:
        sortir_servo("L")
        set_feedback(f"{nama} {conf:.2f} -> PULUNG (kiri)", COLOR_SUCCESS, DURASI_HASIL)
        sounds.play("ok")
    else:
        sortir_servo("R")
        set_feedback(f"{nama} {conf:.2f} -> BUANG (kanan)", COLOR_OFFLINE, DURASI_HASIL)
        sounds.play("ok")


def process_trash(frame):
    h, w = frame.shape[:2]
    cv2.putText(frame, "Tekan SPASI untuk foto & sortir",
                (12, h - 50), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1, cv2.LINE_AA)


# ---------------------------------------------------------------------------
# Switch kamera/mode
# ---------------------------------------------------------------------------
def on_mouse(event, x, y, flags, param):
    global switch_requested
    if event == cv2.EVENT_LBUTTONDOWN:
        bx1, by1, bx2, by2 = button_rect
        if bx1 <= x <= bx2 and by1 <= y <= by2:
            switch_requested = True


def switch_mode(cap):
    """Tutup kamera lama, buka kamera mode berikutnya. Return cap baru."""
    global mode
    cap.release()
    if mode == "qr":
        mode = "trash"
        print("[MODE] -> SAMPAH (kamera external)")
        new_cap = open_camera(CAMERA_TRASH, hi_res=False)
    else:
        mode = "qr"
        print("[MODE] -> QR (kamera bawaan)")
        new_cap = open_camera(CAMERA_QR, hi_res=True)
    if not new_cap.isOpened():
        set_feedback("Kamera mode ini tidak terbuka!", COLOR_ERROR, 3.0)
    return new_cap


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    global switch_requested

    offline_queue.init_db()
    threading.Thread(target=retry_worker, daemon=True).start()
    threading.Thread(target=heartbeat_worker, daemon=True).start()

    print(f"HolyBin App  —  Bin: {config.BIN_CODE}")
    print(f"Servo gateway: {SERVO_URL}   Backend: {config.API_BASE_URL}")
    print("Klik [SWITCH] atau tekan S/TAB untuk ganti mode. Q untuk keluar.\n")

    cap = open_camera(CAMERA_QR, hi_res=True)
    if not cap.isOpened():
        raise RuntimeError(f"Kamera QR ({CAMERA_QR}) tidak terbuka. Cek CAMERA_QR / koneksi kamera.")

    cv2.namedWindow(WINDOW_NAME, cv2.WINDOW_NORMAL)
    cv2.resizeWindow(WINDOW_NAME, 900, 640)
    cv2.setMouseCallback(WINDOW_NAME, on_mouse)

    while True:
        ret, frame = cap.read()
        if not ret or frame is None:
            # Kamera mode ini gagal baca: tampilkan layar hitam + tombol,
            # supaya user masih bisa klik SWITCH untuk kembali ke kamera lain.
            frame = np.zeros((480, 640, 3), dtype="uint8")
            set_feedback("Gagal baca kamera — coba SWITCH", COLOR_ERROR, 1.0)
            draw_header(frame)
            draw_switch_button(frame)
            draw_feedback(frame)
            cv2.imshow(WINDOW_NAME, frame)
            key = cv2.waitKey(30) & 0xFF
            if key == ord("q"):
                break
            if key in (ord("s"), 9) or switch_requested:
                switch_requested = False
                cap = switch_mode(cap)
            continue

        if mode == "qr":
            process_qr(frame)
        else:
            process_trash(frame)

        draw_header(frame)
        draw_switch_button(frame)
        draw_feedback(frame)
        cv2.imshow(WINDOW_NAME, frame)

        key = cv2.waitKey(1) & 0xFF
        if key == ord("q"):
            break
        elif key in (ord("s"), 9):          # 9 = TAB
            cap = switch_mode(cap)
        elif key == ord(" ") and mode == "trash":
            classify_trash(frame)

        if switch_requested:
            switch_requested = False
            cap = switch_mode(cap)

    cap.release()
    cv2.destroyAllWindows()
    print("HolyBin App dihentikan.")


if __name__ == "__main__":
    main()
