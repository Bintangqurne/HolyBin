"""
Test servo lewat api_server.py (HTTP).
=====================================
Menggerakkan tiap servo bergantian supaya bisa diamati langsung.

Syarat:
  1. api_server.py SUDAH jalan  ->  python3 api_server.py
  2. ESP32 terhubung & /ping menunjukkan "serial" BUKAN "DUMMY"
     (kalau DUMMY: cek kabel + izin port `sudo chmod a+rw /dev/ttyUSB0`,
      lalu RESTART api_server.py)

Cara pakai:
  python3 test_servo_api.py            # tes semua (sortir + kedua kunci)
  python3 test_servo_api.py sortir     # cuma servo 1 (sortir sampah)
  python3 test_servo_api.py pemulung   # cuma kunci pemulung (servo 2)
  python3 test_servo_api.py kebersihan # cuma kunci kebersihan (servo 3)
"""
import sys
import time
import requests

BASE = "http://localhost:5000"
JEDA = 2.0  # detik antar perintah, beri waktu servo bergerak & diamati


def post(path):
    try:
        r = requests.post(f"{BASE}{path}", timeout=4)
        print(f"  POST {path:24s} -> {r.status_code}  {r.json()}")
        return r.ok
    except Exception as e:
        print(f"  POST {path:24s} -> GAGAL: {e}")
        return False


def cek_koneksi():
    print("== Cek koneksi api_server & serial ==")
    try:
        r = requests.get(f"{BASE}/ping", timeout=4)
        data = r.json()
        print(f"  /ping -> {data}")
        if data.get("serial") == "DUMMY":
            print("  ⚠️  api_server dalam mode DUMMY — perintah TIDAK sampai ke ESP32.")
            print("     Perbaiki: pastikan ESP32 colok + `sudo chmod a+rw /dev/ttyUSB0`,")
            print("     lalu RESTART api_server.py. Tes tetap lanjut (cuma cek HTTP).")
        else:
            print(f"  ✅ Serial aktif: {data.get('serial')}")
        return True
    except Exception as e:
        print(f"  ❌ api_server tidak merespons di {BASE} — jalankan dulu: python3 api_server.py")
        print(f"     ({e})")
        return False


def test_sortir():
    print("\n== Servo 1 (pin 13) — SORTIR SAMPAH ==")
    print("Amati servo sortir: kiri -> kanan -> tengah")
    post("/servo/L"); time.sleep(JEDA)   # pulung (recyclable)
    post("/servo/R"); time.sleep(JEDA)   # buang (non-recyclable)
    post("/servo/C"); time.sleep(JEDA)   # netral


def test_lock(role, servo, pin):
    print(f"\n== Kunci {role} (servo {servo} / pin {pin}) ==")
    print("Amati pintu: BUKA -> (jeda) -> TUTUP")
    post(f"/lock/{role}/open"); time.sleep(JEDA)
    post(f"/lock/{role}/close"); time.sleep(JEDA)


def main():
    arg = sys.argv[1].lower() if len(sys.argv) > 1 else "all"

    if not cek_koneksi():
        sys.exit(1)

    if arg in ("all", "sortir"):
        test_sortir()
    if arg in ("all", "pemulung"):
        test_lock("pemulung", 2, 32)
    if arg in ("all", "kebersihan"):
        test_lock("kebersihan", 3, 27)

    print("\n== Selesai ==")
    print("Tiap perintah balas status 200 + JSON 'ok'. Kalau servo tak bergerak")
    print("padahal status ok -> cek /ping: pastikan 'serial' bukan 'DUMMY'.")


if __name__ == "__main__":
    main()
