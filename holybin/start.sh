#!/bin/bash
# start.sh - Start Holy Bin: upload main.py ke ESP32, reset, lalu jalankan deteksi kamera
#
# Cara pakai:
#   1. Pastikan MicroPico di VS Code sudah DISCONNECT (biar port tidak bentrok)
#   2. chmod +x start.sh   (cukup sekali aja)
#   3. ./start.sh

set -e

PORT="/dev/cu.usbserial-0001"
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

# Aktifkan virtual env
source venv/bin/activate

echo "=============================================="
echo " HOLY BIN - START"
echo "=============================================="

echo "[1/3] Upload main.py ke ESP32 ($PORT)..."
mpremote connect "$PORT" cp main.py :main.py

echo "[2/3] Reset ESP32 supaya main.py jalan..."
mpremote connect "$PORT" reset
sleep 2   # kasih waktu ESP32 boot + jalanin main.py

echo "[3/3] Jalankan deteksi kamera (detect.py)..."
echo "      -> Arahkan webcam ke objek, tekan SPASI untuk sortir, Q untuk keluar."
echo "=============================================="
python detect.py
