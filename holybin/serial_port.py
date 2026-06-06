"""Helper deteksi port serial ESP32 (dipakai api_server.py & detect.py)."""
import os
import serial.tools.list_ports


def detect_serial_port(default="COM3"):
    """Tentukan port serial ESP32.
    Prioritas: env HOLYBIN_SERIAL_PORT > auto-detect (Linux/Mac/Win) > default.
    Kalau env di-set "DUMMY", nilainya dikembalikan apa adanya (mode tanpa ESP32).
    """
    env_port = os.getenv("HOLYBIN_SERIAL_PORT")
    if env_port:
        return env_port
    for p in serial.tools.list_ports.comports():
        dev = p.device.lower()
        desc = (p.description or "").lower()
        if any(k in dev for k in ("ttyusb", "ttyacm", "usbserial", "wchusb")) \
           or any(k in desc for k in ("cp210", "ch340", "ch910", "esp32", "uart", "usb")):
            return p.device
    return default
