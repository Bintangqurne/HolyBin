"""
test_serial.py — Diagnosa koneksi serial ke ESP32
Jalankan: python test_serial.py
Tidak butuh webcam atau YOLO.
"""

import serial
import time

PORT = "/dev/cu.usbserial-0001"
BAUD = 115200

print(f"[1] Membuka serial {PORT}...")
try:
    ser = serial.Serial(PORT, BAUD, timeout=2)
except Exception as e:
    print(f"[GAGAL] Tidak bisa buka port: {e}")
    print("  -> Pastikan MicroPico sudah disconnect dari VS Code")
    print("  -> Pastikan ESP32 tersambung USB")
    exit(1)

print("[2] Menunggu ESP32 boot (3 detik)...")
time.sleep(3)

# Baca output boot dari ESP32
print("[3] Output dari ESP32 setelah boot:")
waiting = ser.in_waiting
if waiting > 0:
    boot_output = ser.read(waiting).decode(errors='replace')
    print(f"    {repr(boot_output)}")
else:
    print("    (tidak ada output — mungkin ESP32 tidak auto-run main.py)")

# Test kirim perintah
def kirim(cmd):
    msg = f"{cmd}\n"
    ser.write(msg.encode())
    print(f"\n[KIRIM] '{cmd}'")
    time.sleep(2)  # tunggu servo gerak + balik
    resp = ser.read(ser.in_waiting).decode(errors='replace')
    if resp:
        print(f"[ESP32] {repr(resp)}")
    else:
        print("[ESP32] (tidak ada balasan)")

print("\n[4] Test perintah servo...")
print("    Servo harusnya gerak ke KIRI...")
kirim('L')

print("    Servo harusnya gerak ke KANAN...")
kirim('R')

print("    Servo harusnya balik TENGAH...")
kirim('C')

print("\n[5] Test ping (handshake)...")
kirim('P')

ser.close()
print("\n[DONE] Test selesai.")
print("Kalau servo tidak gerak sama sekali → masalah di hardware/main.py ESP32")
print("Kalau ada error port → masalah di koneksi serial")
