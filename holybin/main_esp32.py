# main.py - Holy Bin ESP32 Controller
#
# File ini AUTO-RUN saat ESP32 boot (nama "main.py" wajib).
#
# Protokol Serial (dikirim dari laptop lewat USB):
#   L\n  -> servo KIRI  (-60 derajat) : sampah BISA DIPULUNG
#   R\n  -> servo KANAN (+60 derajat) : sampah TIDAK BISA DIPULUNG
#   C\n  -> servo TENGAH (0 derajat)
#   P\n  -> ping, ESP32 balas "OK" (buat handshake dari laptop)

from machine import Pin, PWM, ADC
import time
import sys
import select

# ===== Setup Servo =====
servo = PWM(Pin(13), freq=50)

# ===== Setup LDR =====
ldr = ADC(Pin(34))
ldr.atten(ADC.ATTN_11DB)  # range 0-3.3V

# ===== Konfigurasi sudut =====
SUDUT_KIRI   = -60
SUDUT_TENGAH = 0
SUDUT_KANAN  = 60
WAKTU_TAHAN  = 1.5  # detik - servo nahan posisi sebelum balik tengah


def putar_servo(derajat_custom):
    """Convert -90..+90 jadi 0..180, lalu set PWM duty"""
    derajat_asli = derajat_custom + 90
    if derajat_asli < 0:   derajat_asli = 0
    if derajat_asli > 180: derajat_asli = 180

    min_duty = 1638
    max_duty = 7864
    duty = min_duty + int((derajat_asli / 180.0) * (max_duty - min_duty))
    servo.duty_u16(duty)


def sortir(arah):
    """arah: 'L', 'R', atau 'C'"""
    if arah == 'L':
        print(">> Sortir KIRI (bisa dipulung)")
        putar_servo(SUDUT_KIRI)
        time.sleep(WAKTU_TAHAN)
        putar_servo(SUDUT_TENGAH)
    elif arah == 'R':
        print(">> Sortir KANAN (tidak bisa dipulung)")
        putar_servo(SUDUT_KANAN)
        time.sleep(WAKTU_TAHAN)
        putar_servo(SUDUT_TENGAH)
    elif arah == 'C':
        putar_servo(SUDUT_TENGAH)


def proses_perintah(cmd):
    cmd = cmd.strip().upper()
    if cmd == 'L':
        sortir('L')
    elif cmd == 'R':
        sortir('R')
    elif cmd == 'C':
        sortir('C')
    elif cmd == 'P':
        print("OK")  # handshake reply
    elif cmd:
        # Backward compatible: kalau dikirim angka, set sudut manual
        try:
            sudut = int(cmd)
            putar_servo(sudut)
            print("Manual angle:", sudut)
        except ValueError:
            pass


# ===== Inisialisasi =====
putar_servo(SUDUT_TENGAH)
print("Holy Bin ESP32 siap. Menunggu perintah L/R/C dari laptop...")

# Baca perintah dari USB serial (stdin) secara non-blocking pakai poll
poller = select.poll()
poller.register(sys.stdin, select.POLLIN)

last_ldr_print = 0
LDR_INTERVAL = 2.0  # cetak LDR tiap 2 detik biar ga spam
buf = ""

# ===== Loop utama =====
while True:
    # 1. Cek perintah masuk, baca char demi char (non-blocking)
    if poller.poll(0):
        ch = sys.stdin.read(1)
        if ch:
            if ch == '\n' or ch == '\r':
                if buf:
                    proses_perintah(buf)
                    buf = ""
            else:
                buf += ch

    # 2. Baca LDR sesekali
    now = time.time()
    if now - last_ldr_print >= LDR_INTERVAL:
        nilai_cahaya = ldr.read()
        if nilai_cahaya > 3000:
            kondisi = "Gelap"
        elif nilai_cahaya > 1000:
            kondisi = "Remang"
        else:
            kondisi = "Terang"
        print("LDR:", nilai_cahaya, "(" + kondisi + ")")
        last_ldr_print = now

    time.sleep(0.02)  # kecil aja biar responsif
