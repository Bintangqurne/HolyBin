from flask import Flask, jsonify
import serial
import time
from serial_port import detect_serial_port

SERIAL_PORT = detect_serial_port()
BAUD_RATE   = 115200

# Pemetaan role petugas -> servo kunci.
#   pemulung   -> servo 2 (pin 32): kompartemen sampah BISA DIPULUNG (recyclable)
#   kebersihan -> servo 3 (pin 27): kompartemen sampah TIDAK BISA DIPULUNG
ROLE_SERVO = {"pemulung": 2, "kebersihan": 3}

# Status kunci tiap servo (False = terkunci/tutup, True = terbuka).
# Disimpan di memori: scan pertama membuka, scan berikutnya menutup (check-in/check-out).
lock_state = {2: False, 3: False}

app = Flask(__name__)

print(f"[INIT] Membuka serial {SERIAL_PORT}...")
try:
    ser = serial.Serial()
    ser.port     = SERIAL_PORT
    ser.baudrate = BAUD_RATE
    ser.timeout  = 1
    ser.dtr      = False
    ser.rts      = False
    ser.open()
    time.sleep(0.5)
    ser.reset_input_buffer()
    print("[INIT] Serial terhubung ke ESP32.")
except Exception as e:
    print(f"[WARN] Gagal buka serial: {e}")
    print("[WARN] Jalan dalam mode DUMMY - perintah tidak dikirim ke ESP32.")
    ser = None


def kirim(cmd):
    if ser is None:
        print(f"[DRY] Would send: {cmd}")
        return
    ser.write(f"{cmd}\n".encode())
    print(f"[SERIAL] Sent: {cmd}")


@app.route('/servo/<arah>', methods=['POST'])
def gerak_servo(arah):
    arah = arah.upper()
    if arah not in ('L', 'R', 'C'):
        return jsonify({"error": "arah harus L (kiri), R (kanan), atau C (tengah)"}), 400
    kirim(arah)
    label = {"L": "KIRI", "R": "KANAN", "C": "TENGAH"}[arah]
    return jsonify({"status": "ok", "servo": 1, "arah": arah, "posisi": label})


@app.route('/servo2/<arah>', methods=['POST'])
def gerak_servo2(arah):
    arah = arah.upper()
    if arah not in ('L', 'R', 'C'):
        return jsonify({"error": "arah harus L (kiri), R (kanan), atau C (tengah)"}), 400
    kirim(f"2{arah}")
    label = {"L": "KIRI", "R": "KANAN", "C": "TENGAH"}[arah]
    return jsonify({"status": "ok", "servo": 2, "arah": arah, "posisi": label})


@app.route('/servo3/<arah>', methods=['POST'])
def gerak_servo3(arah):
    arah = arah.upper()
    if arah not in ('L', 'R', 'C'):
        return jsonify({"error": "arah harus L (kiri), R (kanan), atau C (tengah)"}), 400
    kirim(f"3{arah}")
    label = {"L": "KIRI", "R": "KANAN", "C": "TENGAH"}[arah]
    return jsonify({"status": "ok", "servo": 3, "arah": arah, "posisi": label})


@app.route('/lock/<role>', methods=['POST'])
def toggle_lock(role):
    """Dipanggil scanner saat QR petugas dikenali.
    Toggle kunci kompartemen sesuai role: scan -> buka, scan lagi -> tutup.
    pemulung -> servo 2, kebersihan -> servo 3."""
    role = role.lower().strip()
    if role not in ROLE_SERVO:
        return jsonify({"error": f"role tidak dikenal: {role}. Pakai 'pemulung' atau 'kebersihan'."}), 400

    sv = ROLE_SERVO[role]
    buka = not lock_state[sv]          # toggle
    kirim(f"{sv}{'O' if buka else 'C'}")
    lock_state[sv] = buka

    return jsonify({
        "status": "ok",
        "role": role,
        "servo": sv,
        "aksi": "buka kunci" if buka else "tutup kunci",
        "terbuka": buka,
    })


@app.route('/lock/<role>/<aksi>', methods=['POST'])
def set_lock(role, aksi):
    """Set kunci eksplisit (tanpa toggle): aksi = 'open' atau 'close'.
    Berguna untuk reset/override manual dari dashboard."""
    role = role.lower().strip()
    aksi = aksi.lower().strip()
    if role not in ROLE_SERVO:
        return jsonify({"error": f"role tidak dikenal: {role}"}), 400
    if aksi not in ("open", "close"):
        return jsonify({"error": "aksi harus 'open' atau 'close'"}), 400

    sv = ROLE_SERVO[role]
    buka = aksi == "open"
    kirim(f"{sv}{'O' if buka else 'C'}")
    lock_state[sv] = buka
    return jsonify({"status": "ok", "role": role, "servo": sv, "terbuka": buka})


@app.route('/ping', methods=['GET'])
def ping():
    return jsonify({
        "status": "ok",
        "serial": SERIAL_PORT if ser else "DUMMY",
        "lock": {"pemulung": lock_state[2], "kebersihan": lock_state[3]},
    })


if __name__ == '__main__':
    print("[RUN] API server berjalan di http://localhost:5000")
    print("      Servo 1 (pin 13): POST /servo/L  |  POST /servo/R  |  POST /servo/C")
    print("      Servo 2 (pin 32): POST /servo2/L |  POST /servo2/R |  POST /servo2/C")
    print("      Servo 3 (pin 27): POST /servo3/L |  POST /servo3/R |  POST /servo3/C")
    print("      Toggle kunci    : POST /lock/pemulung   |  POST /lock/kebersihan")
    print("      Set kunci       : POST /lock/<role>/open |  POST /lock/<role>/close")
    print("      Health          : GET  /ping")
    app.run(host='0.0.0.0', port=5000)
