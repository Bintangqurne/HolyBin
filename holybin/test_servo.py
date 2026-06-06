# test_servo.py - Tes servo langsung di ESP32 (loop terus-menerus)
#
# Script ini JALAN DI ESP32 (MicroPython), bukan di laptop.
# Tujuannya: cek apakah servo bergerak secara fisik, lepas dari logika serial/kamera.
#
# Cara jalanin dari laptop:
#   mpremote connect /dev/cu.usbserial-0001 run test_servo.py
#
# Hentikan dengan Ctrl+C.

from machine import Pin, PWM
import time

servo = PWM(Pin(13), freq=50)

SUDUT_KIRI   = -60
SUDUT_TENGAH = 0
SUDUT_KANAN  = 60


def putar_servo(derajat_custom):
    """Convert -90..+90 jadi 0..180, lalu set PWM duty"""
    derajat_asli = derajat_custom + 90
    if derajat_asli < 0:   derajat_asli = 0
    if derajat_asli > 180: derajat_asli = 180
    min_duty = 1638
    max_duty = 7864
    duty = min_duty + int((derajat_asli / 180.0) * (max_duty - min_duty))
    servo.duty_u16(duty)
    return duty


print("=== TEST SERVO - Loop ===")
print("Servo akan bolak-balik: KIRI -> TENGAH -> KANAN -> TENGAH terus.")
print("Perhatikan servo bergerak fisik atau tidak. Ctrl+C untuk stop.\n")

putar_servo(SUDUT_TENGAH)
time.sleep(1)

siklus = 0
while True:
    siklus += 1
    print("Siklus", siklus)

    d = putar_servo(SUDUT_KIRI)
    print("  -> KIRI   (-60)  duty =", d)
    time.sleep(1.5)

    d = putar_servo(SUDUT_TENGAH)
    print("  -> TENGAH ( 0 )  duty =", d)
    time.sleep(1.5)

    d = putar_servo(SUDUT_KANAN)
    print("  -> KANAN  (+60)  duty =", d)
    time.sleep(1.5)

    d = putar_servo(SUDUT_TENGAH)
    print("  -> TENGAH ( 0 )  duty =", d)
    time.sleep(1.5)
