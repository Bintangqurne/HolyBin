"""Cari kamera yang aktif dan tampilkan preview-nya. Tekan Q untuk keluar."""
import cv2

print("Mencari kamera yang tersedia...")

# Cari kamera aktif dari index 0–5
active = []
for i in range(6):
    cap = cv2.VideoCapture(i)
    if cap.isOpened():
        ret, frame = cap.read()
        if ret and frame is not None:
            active.append(i)
            print(f"  ✅ Kamera index {i} — aktif")
        else:
            print(f"  ⚠️  Kamera index {i} — terbuka tapi tidak ada frame")
        cap.release()
    else:
        print(f"  ❌ Kamera index {i} — tidak ditemukan")

if not active:
    print("\nTidak ada kamera yang ditemukan. Pastikan kamera terhubung.")
    exit(1)

import sys
idx = int(sys.argv[1]) if len(sys.argv) > 1 else active[0]
print(f"\nMembuka kamera index {idx} — tekan Q untuk keluar.")
print(f"Kalau gambar sudah benar, set CAMERA_INDEX={idx} di scanner/.env\n")

cap = cv2.VideoCapture(idx)
while True:
    ret, frame = cap.read()
    if not ret:
        continue
    cv2.putText(frame, f"Kamera index {idx} — Tekan Q untuk keluar",
                (10, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 220, 120), 1)
    cv2.imshow("Camera Test", frame)
    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

cap.release()
cv2.destroyAllWindows()
