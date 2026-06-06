import os
from dotenv import load_dotenv

load_dotenv()

BIN_CODE: str = os.environ["BIN_CODE"]
API_BASE_URL: str = os.environ["API_BASE_URL"].rstrip("/")
SCANNER_TOKEN: str = os.environ["SCANNER_API_TOKEN"]
COOLDOWN_SECONDS: float = float(os.getenv("COOLDOWN_SECONDS", "5"))

# Kamera scanner = kamera BAWAAN laptop. Bisa diisi angka indeks (mis. "0")
# atau path device stabil (mis. /dev/v4l/by-id/usb-Sonix...-video-index0).
_cam: str = os.getenv("CAMERA_INDEX", "0").strip()
CAMERA_INDEX = int(_cam) if _cam.lstrip("-").isdigit() else _cam
SOUND_ENABLED: bool = os.getenv("SOUND_ENABLED", "true").lower() == "true"
SNAPSHOT_ENABLED: bool = os.getenv("SNAPSHOT_ENABLED", "true").lower() == "true"
ANTI_PHONE_SCREEN: bool = os.getenv("ANTI_PHONE_SCREEN", "false").lower() == "true"

# Servo kunci holybin: toggle kompartemen sesuai role petugas saat scan.
#   pemulung   -> servo 2 (pin 25): kompartemen recyclable
#   kebersihan -> servo 3 (pin 27): kompartemen non-recyclable
SERVO_ENABLED: bool = os.getenv("SERVO_ENABLED", "true").lower() == "true"
HOLYBIN_API_URL: str = os.getenv("HOLYBIN_API_URL", "http://localhost:5000").rstrip("/")
# Status absen yang memicu servo (pisahkan koma).
# Default 'ok,info': scan pertama (ok) BUKA kunci, scan berikutnya dalam cooldown (info) TUTUP kunci.
SERVO_TRIGGER_ON: set[str] = {s.strip() for s in os.getenv("SERVO_TRIGGER_ON", "ok,info").split(",") if s.strip()}
