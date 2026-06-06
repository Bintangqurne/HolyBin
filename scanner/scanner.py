"""
TrashSync QR Scanner
====================
Jalankan: python3 scanner.py
Berhenti: tekan Q di jendela kamera
"""

import time
import requests
import cv2
from pyzbar.pyzbar import decode, ZBarSymbol

import os
import threading
import config
import sounds
import scan_queue as offline_queue

WINDOW_NAME = "TrashSync Scanner"  # ASCII only — em-dash bisa bermasalah di Qt

ATTENDANCE_URL = f"{config.API_BASE_URL}/api/attendance"
HEADERS = {
    "Content-Type": "application/json",
    "X-Scanner-Token": config.SCANNER_TOKEN,
}

# debounce: userCode -> last-accepted timestamp
last_seen: dict[str, float] = {}

# overlay feedback
feedback: dict = {"text": "", "color": (200, 200, 200), "until": 0.0}

# warna guide box: berubah berdasarkan status
# BGR format
COLOR_IDLE    = (160, 160, 160)   # abu-abu  — menunggu QR
COLOR_DETECT  = (0,   220, 220)   # kuning   — QR terdeteksi
COLOR_SUCCESS = (0,   220, 120)   # hijau    — berhasil absen
COLOR_INFO    = (240, 180,  50)   # biru     — sudah absen (cooldown)
COLOR_OFFLINE = (100, 160, 240)   # oranye   — disimpan offline
COLOR_ERROR   = (50,  80,  240)   # merah    — gagal

guide_color  = COLOR_IDLE
guide_until  = 0.0   # timestamp sampai kapan warna non-idle dipertahankan


def get_guide_rect(w: int, h: int) -> tuple[int, int, int, int]:
    """Kembalikan (x1, y1, x2, y2) kotak panduan di tengah layar."""
    size = int(min(w, h) * 0.55)
    cx, cy = w // 2, h // 2
    return cx - size // 2, cy - size // 2, cx + size // 2, cy + size // 2


def draw_corner_marker(frame, x1, y1, x2, y2, color, length=28, thickness=3):
    """Gambar empat sudut kotak panduan (bukan kotak penuh)."""
    # sudut kiri-atas
    cv2.line(frame, (x1, y1), (x1 + length, y1), color, thickness)
    cv2.line(frame, (x1, y1), (x1, y1 + length), color, thickness)
    # sudut kanan-atas
    cv2.line(frame, (x2, y1), (x2 - length, y1), color, thickness)
    cv2.line(frame, (x2, y1), (x2, y1 + length), color, thickness)
    # sudut kiri-bawah
    cv2.line(frame, (x1, y2), (x1 + length, y2), color, thickness)
    cv2.line(frame, (x1, y2), (x1, y2 - length), color, thickness)
    # sudut kanan-bawah
    cv2.line(frame, (x2, y2), (x2 - length, y2), color, thickness)
    cv2.line(frame, (x2, y2), (x2, y2 - length), color, thickness)


def draw_guide(frame, color):
    h, w = frame.shape[:2]
    x1, y1, x2, y2 = get_guide_rect(w, h)

    # overlay gelap di luar kotak panduan
    overlay = frame.copy()
    cv2.rectangle(overlay, (0, 0), (w, h), (0, 0, 0), -1)
    cv2.rectangle(overlay, (x1, y1), (x2, y2), (0, 0, 0), -1)   # bersihkan area dalam
    cv2.addWeighted(overlay, 0.35, frame, 0.65, 0, frame)

    # sudut marker
    draw_corner_marker(frame, x1, y1, x2, y2, color)

    # label instruksi di bawah kotak
    label = "Arahkan QR ke dalam kotak"
    font = cv2.FONT_HERSHEY_SIMPLEX
    scale, thick = 0.55, 1
    (tw, th), _ = cv2.getTextSize(label, font, scale, thick)
    lx = (w - tw) // 2
    ly = y2 + 26
    cv2.putText(frame, label, (lx, ly), font, scale, color, thick, cv2.LINE_AA)

    return x1, y1, x2, y2


def qr_inside_guide(qr_pts, x1, y1, x2, y2) -> bool:
    """Cek apakah semua titik sudut QR berada di dalam kotak panduan."""
    return all(x1 <= p.x <= x2 and y1 <= p.y <= y2 for p in qr_pts)


def draw_feedback_bar(frame):
    if time.time() < feedback["until"]:
        h, w = frame.shape[:2]
        text  = feedback["text"]
        color = feedback["color"]
        font  = cv2.FONT_HERSHEY_SIMPLEX
        scale, thick = 0.72, 2
        (tw, th), _ = cv2.getTextSize(text, font, scale, thick)
        x = (w - tw) // 2
        y = h - 22
        cv2.rectangle(frame, (0, y - th - 14), (w, h), (15, 15, 15), -1)
        cv2.putText(frame, text, (x, y), font, scale, color, thick, cv2.LINE_AA)


def set_feedback(text: str, color, duration: float = 3.0):
    feedback["text"]  = text
    feedback["color"] = color
    feedback["until"] = time.time() + duration


def post_attendance(user_code: str, scanned_at: float | None = None) -> tuple[str, str, str | None]:
    """Return (status, message, role). status: 'ok' | 'info' | 'offline' | 'error'.
    role: 'pemulung' | 'kebersihan' | None (None kalau offline/error)."""
    payload: dict = {"userCode": user_code, "binCode": config.BIN_CODE}
    if scanned_at:
        import datetime
        payload["scannedAt"] = datetime.datetime.utcfromtimestamp(scanned_at).isoformat() + "Z"
    try:
        r = requests.post(ATTENDANCE_URL, json=payload, headers=HEADERS, timeout=6)
        data = r.json()
        if r.status_code == 200 and data.get("ok"):
            role = data.get("userRole")
            if data.get("alreadyScanned"):
                mins = data.get("minutesAgo", 0)
                name = data.get("userName", "")
                return "info", f"Sudah absen {mins} menit lalu  —  {name}", role
            return "ok", f"Absen: {data.get('userName')}  @  {data.get('binLocation')}", role
        return "error", data.get("error", f"HTTP {r.status_code}"), None
    except (requests.exceptions.ConnectionError, requests.exceptions.Timeout):
        # Simpan ke offline queue
        ts = scanned_at or time.time()
        offline_queue.enqueue(user_code, config.BIN_CODE, ts)
        pending = offline_queue.pending_count()
        return "offline", f"Offline — tersimpan lokal ({pending} antrian)", None
    except Exception as e:
        return "error", str(e), None


def trigger_servo(role: str) -> None:
    """Toggle kunci kompartemen holybin sesuai role petugas saat absen.
    pemulung -> servo 2 (recyclable), kebersihan -> servo 3 (non-recyclable).
    Scan pertama membuka & menahan, scan berikutnya menutup (check-in/check-out).
    Fire-and-forget di daemon thread agar loop kamera tidak freeze dan
    kegagalan servo tidak menggagalkan absen."""
    if not config.SERVO_ENABLED:
        return
    if role not in ("pemulung", "kebersihan"):
        print(f"  [servo] role tidak dikenal: {role!r}, kunci tidak digerakkan.")
        return

    def _send():
        try:
            requests.post(f"{config.HOLYBIN_API_URL}/lock/{role}", headers=HEADERS, timeout=3)
        except Exception as e:
            print(f"  [servo] gagal kirim ke holybin: {e}")

    threading.Thread(target=_send, daemon=True).start()


def heartbeat_worker() -> None:
    """Background thread: ping backend tiap 60 detik agar admin tahu scanner masih aktif."""
    url = f"{config.API_BASE_URL}/api/heartbeat"
    while True:
        try:
            requests.post(url, json={"binCode": config.BIN_CODE}, headers=HEADERS, timeout=5)
        except Exception:
            pass
        time.sleep(60)


def retry_worker() -> None:
    """Background thread: coba kirim ulang scan yang tersimpan offline tiap 30 detik."""
    while True:
        time.sleep(30)
        pending = offline_queue.get_pending()
        if not pending:
            continue
        print(f"[RETRY] {len(pending)} scan offline sedang di-sync...")
        for item in pending:
            status, msg, _role = post_attendance(item["user_code"], item["scanned_at"])
            if status in ("ok", "info"):
                offline_queue.mark_synced(item["id"])
                print(f"  ✓ Sync berhasil: {item['user_code']} — {msg}")
            else:
                offline_queue.increment_retry(item["id"])
                print(f"  ✗ Retry gagal ({item['retry_count'] + 1}×): {msg}")


SNAPSHOT_DIR = os.path.join(os.path.dirname(__file__), "snapshots")

def save_snapshot(frame, user_code: str) -> None:
    if not config.SNAPSHOT_ENABLED:
        return
    try:
        os.makedirs(SNAPSHOT_DIR, exist_ok=True)
        ts = time.strftime("%Y%m%d-%H%M%S")
        cv2.imwrite(os.path.join(SNAPSHOT_DIR, f"{user_code}_{ts}.jpg"), frame)
        cutoff = time.time() - 30 * 86400
        for f in os.listdir(SNAPSHOT_DIR):
            fp = os.path.join(SNAPSHOT_DIR, f)
            if os.path.getmtime(fp) < cutoff:
                os.remove(fp)
    except Exception as e:
        print(f"  [snapshot] error: {e}")


_qr_history: dict[str, list] = {}

def is_likely_phone_screen(user_code: str, pts) -> bool:
    if not config.ANTI_PHONE_SCREEN or len(pts) < 4:
        return False
    corners = [(p.x, p.y) for p in pts[:4]]
    history = _qr_history.setdefault(user_code, [])
    history.append(corners)
    if len(history) > 5:
        history.pop(0)
    if len(history) < 3:
        return False
    total_move = sum(
        ((x2 - x1) ** 2 + (y2 - y1) ** 2) ** 0.5
        for prev, curr in zip(history[-2:], history[-1:])
        for (x1, y1), (x2, y2) in zip(prev, curr)
    )
    return total_move < 2.0


def main():
    global guide_color, guide_until

    offline_queue.init_db()
    threading.Thread(target=retry_worker, daemon=True, name="retry-worker").start()
    threading.Thread(target=heartbeat_worker, daemon=True, name="heartbeat").start()

    print(f"TrashSync Scanner  —  Bin: {config.BIN_CODE}")
    print(f"Backend : {config.API_BASE_URL}")
    print("Tekan Q untuk berhenti.\n")

    # Path device (string) butuh backend V4L2 eksplisit; indeks angka pakai default.
    if isinstance(config.CAMERA_INDEX, str):
        cap = cv2.VideoCapture(config.CAMERA_INDEX, cv2.CAP_V4L2)
    else:
        cap = cv2.VideoCapture(config.CAMERA_INDEX)
    # Naikkan resolusi kamera agar QR lebih mudah dideteksi
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
    cap.set(cv2.CAP_PROP_FPS, 30)
    if not cap.isOpened():
        # Coba index lain secara otomatis
        for fallback in range(4):
            if fallback == config.CAMERA_INDEX:
                continue
            cap = cv2.VideoCapture(fallback)
            if cap.isOpened():
                print(f"  → Beralih ke kamera index {fallback}")
                break
        else:
            raise RuntimeError("Tidak bisa membuka kamera manapun. Cek koneksi kamera.")

    # Buat window eksplisit dengan ukuran normal agar pasti tampil
    cv2.namedWindow(WINDOW_NAME, cv2.WINDOW_NORMAL)
    cv2.resizeWindow(WINDOW_NAME, 800, 600)

    while True:
        ret, frame = cap.read()
        if not ret:
            continue

        h, w = frame.shape[:2]

        # Tampilkan frame dulu sebelum decode agar window tidak freeze
        cv2.imshow(WINDOW_NAME, frame)
        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

        # Grayscale + unsharp mask → strategi terbaik dari benchmark (100% deteksi)
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        blur = cv2.GaussianBlur(gray, (0, 0), 3)
        sharp = cv2.addWeighted(gray, 1.7, blur, -0.7, 0)
        qr_list = decode(sharp, symbols=[ZBarSymbol.QRCODE])

        # Tentukan warna guide box saat ini
        now = time.time()
        if now >= guide_until:
            guide_color = COLOR_DETECT if qr_list else COLOR_IDLE

        # Gambar overlay + kotak panduan
        gx1, gy1, gx2, gy2 = draw_guide(frame, guide_color)

        for qr in qr_list:
            user_code = qr.data.decode("utf-8").strip()
            pts = qr.polygon

            # Gambar kotak di sekitar QR yang terdeteksi
            if len(pts) == 4:
                inside = qr_inside_guide(pts, gx1, gy1, gx2, gy2)
                box_color = COLOR_SUCCESS if inside else COLOR_DETECT
                for j in range(4):
                    cv2.line(
                        frame,
                        (pts[j].x, pts[j].y),
                        (pts[(j + 1) % 4].x, pts[(j + 1) % 4].y),
                        box_color, 2,
                    )

            # Hanya proses kode user (awalan "U-") yang ada di dalam kotak
            if not user_code.upper().startswith("U-"):
                set_feedback("Bukan QR petugas — gunakan kartu yang benar", COLOR_ERROR, 2.0)
                continue

            if not qr_inside_guide(pts, gx1, gy1, gx2, gy2):
                continue   # tunggu sampai benar-benar di dalam kotak

            if now - last_seen.get(user_code, 0) < config.COOLDOWN_SECONDS:
                continue

            # Anti-foto QR: tolak kalau QR terlalu statis (kemungkinan layar HP)
            if is_likely_phone_screen(user_code, pts):
                set_feedback("Gunakan kartu QR fisik, bukan foto layar HP", COLOR_ERROR, 2.5)
                sounds.play("error")
                continue

            last_seen[user_code] = now

            print(f"[SCAN] userCode={user_code}  binCode={config.BIN_CODE}")
            status, msg, role = post_attendance(user_code)
            print(f"  → {status.upper()} {msg}  (role={role})")

            if status == "ok":
                save_snapshot(frame, user_code)

            if status in config.SERVO_TRIGGER_ON and role:
                trigger_servo(role)

            result_color = {"ok": COLOR_SUCCESS, "info": COLOR_INFO, "offline": COLOR_OFFLINE, "error": COLOR_ERROR}.get(status, COLOR_ERROR)
            set_feedback(msg[:65], result_color, 3.5)
            sounds.play(status)
            guide_color = result_color
            guide_until = now + 2.0

        # Header bar
        cv2.rectangle(frame, (0, 0), (w, 40), (15, 15, 15), -1)
        cv2.putText(
            frame,
            f"HolyBin Scanner  |  Bin: {config.BIN_CODE}",
            (12, 26),
            cv2.FONT_HERSHEY_SIMPLEX, 0.6,
            (0, 220, 120), 1, cv2.LINE_AA,
        )

        draw_feedback_bar(frame)

    cap.release()
    cv2.destroyAllWindows()
    print("Scanner dihentikan.")


if __name__ == "__main__":
    main()
