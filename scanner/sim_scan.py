"""
sim_scan.py — Simulasi scan QR TANPA kamera.
Mengirim userCode langsung ke API absen + memicu servo, persis seperti scanner.py
saat berhasil decode QR. Berguna untuk testing cepat / otomatis.

Cara pakai:
    python3 sim_scan.py U-XXXX            # 1x scan (check-in)
    python3 sim_scan.py U-XXXX U-YYYY     # beberapa petugas sekaligus
    python3 sim_scan.py U-XXXX --twice    # check-in lalu check-out (jeda otomatis)

Mengikuti konfigurasi di .env (BIN_CODE, API_BASE_URL, SERVO_ENABLED, dll).
"""

import sys
import time

import scanner   # pakai ulang fungsi & config asli (tidak membuka kamera saat di-import)


def kirim_satu(user_code: str) -> None:
    user_code = user_code.strip().upper()
    print(f"\n[SCAN] userCode={user_code}  binCode={scanner.config.BIN_CODE}")
    status, msg, role = scanner.post_attendance(user_code)
    print(f"  -> {status.upper()}  {msg}  (role={role})")

    if status in scanner.config.SERVO_TRIGGER_ON and role:
        scanner.trigger_servo(role)
        print(f"  -> servo '{role}' ditrigger (toggle kunci)")
    elif status in scanner.config.SERVO_TRIGGER_ON and not role:
        print("  -> role tidak diketahui, servo tidak digerakkan")

    # beri waktu daemon thread (post servo) selesai sebelum program keluar
    time.sleep(1.0)


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    twice = "--twice" in sys.argv

    if not args:
        print("Usage: python3 sim_scan.py U-XXXX [U-YYYY ...] [--twice]")
        sys.exit(1)

    scanner.offline_queue.init_db()  # supaya fallback offline tetap berfungsi

    for code in args:
        kirim_satu(code)
        if twice:
            print("  ... tunggu 6 detik untuk simulasi check-out ...")
            time.sleep(6)
            kirim_satu(code)

    print("\n[DONE] Simulasi selesai.")


if __name__ == "__main__":
    main()
