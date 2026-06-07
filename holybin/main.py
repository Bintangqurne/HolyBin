# main.py - Holy Bin ESP32 Controller
#
# File ini AUTO-RUN saat ESP32 boot (nama "main.py" wajib).
#
# Protokol Serial (dikirim dari laptop lewat USB):
#   Servo 1 (pin 13) = SORTIR sampah (auto-balik ke tengah):
#     L\n  -> servo KIRI  (-60 derajat) : sampah BISA DIPULUNG
#     R\n  -> servo KANAN (+60 derajat) : sampah TIDAK BISA DIPULUNG
#     C\n  -> servo TENGAH (0 derajat)
#   Servo 2 (pin 32) = KUNCI pintu PEMULUNG (recyclable) — TAHAN, tidak auto-balik:
#     2O\n -> BUKA kunci (putar 90 derajat & tahan)
#     2C\n -> TUTUP kunci (balik 0 derajat & tahan)
#   Servo 3 (pin 27) = KUNCI pintu KEBERSIHAN (non-recyclable) — TAHAN:
#     3O\n -> BUKA kunci (putar 90 derajat & tahan)
#     3C\n -> TUTUP kunci (balik 0 derajat & tahan)
#   P\n  -> ping, ESP32 balas "OK" (buat handshake dari laptop)

from machine import Pin, PWM, ADC
import time
import sys
import select

# ===== Setup Servo =====
servo  = PWM(Pin(13), freq=50)
servo2 = PWM(Pin(32), freq=50)
servo3 = PWM(Pin(27), freq=50)

# ===== Setup LDR =====
ldr = ADC(Pin(34))
ldr.atten(ADC.ATTN_11DB)  # range 0-3.3V

# ===== Konfigurasi sudut =====
SUDUT_KIRI   = -80
SUDUT_TENGAH = 0
SUDUT_KANAN  = 80
WAKTU_TAHAN  = 1.5  # detik - servo nahan posisi sebelum balik tengah

# Sudut untuk servo KUNCI (buka = TAHAN, tidak auto-balik). Bisa beda per pintu.
SUDUT_BUKA_PEMULUNG   = 60   # servo 2 (pemulung): pintu terbuka 60 derajat
SUDUT_BUKA_KEBERSIHAN = 90   # servo 3 (kebersihan): pintu terbuka 90 derajat
SUDUT_TUTUP_KUNCI     = 0    # pintu terkunci (posisi tengah)


def putar_servo(derajat_custom, s=None):
    """Convert -90..+90 jadi 0..180, lalu set PWM duty. s = objek servo (default servo pin 13)"""
    if s is None:
        s = servo
    derajat_asli = derajat_custom + 90
    if derajat_asli < 0:   derajat_asli = 0
    if derajat_asli > 180: derajat_asli = 180

    min_duty = 1638
    max_duty = 7864
    duty = min_duty + int((derajat_asli / 180.0) * (max_duty - min_duty))
    s.duty_u16(duty)


def sortir(arah, s=None):
    """arah: 'L', 'R', atau 'C'. s = objek servo (default servo pin 13)"""
    if s is None:
        s = servo
    if arah == 'L':
        print(">> Sortir KIRI (bisa dipulung)")
        putar_servo(SUDUT_KIRI, s)
        time.sleep(WAKTU_TAHAN)
        putar_servo(SUDUT_TENGAH, s)
    elif arah == 'R':
        print(">> Sortir KANAN (tidak bisa dipulung)")
        putar_servo(SUDUT_KANAN, s)
        time.sleep(WAKTU_TAHAN)
        putar_servo(SUDUT_TENGAH, s)
    elif arah == 'C':
        putar_servo(SUDUT_TENGAH, s)


def kunci(s, buka, sudut_buka=90):
    """Servo kunci pintu: buka (putar ke sudut_buka) atau tutup (balik 0), lalu TAHAN.
    Beda dari sortir() yang otomatis balik tengah — kunci harus tetap di posisinya
    sampai perintah berikutnya (check-in / check-out)."""
    if buka:
        print(">> BUKA kunci (tahan", sudut_buka, ")")
        putar_servo(sudut_buka, s)
    else:
        print(">> TUTUP kunci (tahan 0)")
        putar_servo(SUDUT_TUTUP_KUNCI, s)


def proses_perintah(cmd):
    cmd = cmd.strip().upper()
    # Servo 1 (pin 13) — SORTIR sampah (auto-balik tengah)
    if cmd == 'L':
        sortir('L', servo)
    elif cmd == 'R':
        sortir('R', servo)
    elif cmd == 'C':
        sortir('C', servo)
    # Servo 2 (pin 32) — KUNCI pemulung (buka/tutup, tahan posisi)
    elif cmd == '2O':
        kunci(servo2, True, SUDUT_BUKA_PEMULUNG)
    elif cmd == '2C':
        kunci(servo2, False)
    # Servo 3 (pin 27) — KUNCI kebersihan (buka/tutup, tahan posisi)
    elif cmd == '3O':
        kunci(servo3, True, SUDUT_BUKA_KEBERSIHAN)
    elif cmd == '3C':
        kunci(servo3, False)
    elif cmd == 'P':
        print("OK")  # handshake reply
    elif cmd:
        try:
            sudut = int(cmd)
            putar_servo(sudut)
            print("Manual angle:", sudut)
        except ValueError:
            pass


# ===== Inisialisasi =====
putar_servo(SUDUT_TENGAH, servo)          # servo sortir di tengah
putar_servo(SUDUT_TUTUP_KUNCI, servo2)    # kunci pemulung: terkunci
putar_servo(SUDUT_TUTUP_KUNCI, servo3)    # kunci kebersihan: terkunci
print("Holy Bin ESP32 siap. Perintah: L/R/C (sortir) | 2O/2C (kunci pemulung) | 3O/3C (kunci kebersihan)")

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
