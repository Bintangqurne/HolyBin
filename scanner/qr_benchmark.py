"""
QR Detection Benchmark
======================
Cara pakai:
  1. Taruh foto-foto QR ke folder scanner/test_images/
     (boleh .jpg / .png — apa saja format umum)
  2. Jalankan:  python3 qr_benchmark.py
  3. Lihat hasil per-strategi di terminal + folder scanner/test_output/

Script ini mencoba beberapa strategi preprocessing
dan melaporkan strategi mana yang paling banyak berhasil
mendeteksi QR pada foto-foto Anda. Hasilnya bisa dipakai
untuk meng-tune scanner.py.
"""

import os
import sys
import glob
import time
import cv2
import numpy as np
from pyzbar.pyzbar import decode, ZBarSymbol

INPUT_DIR  = os.path.join(os.path.dirname(__file__), "test_images")
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "test_output")


# ──────────────────────────────────────────────────────────
# Strategi-strategi preprocessing
# Setiap strategi adalah fungsi: image -> list[ZBar.Decoded]
# ──────────────────────────────────────────────────────────

def s_color(img):
    """Pyzbar pada frame berwarna apa adanya."""
    return decode(img, symbols=[ZBarSymbol.QRCODE])

def s_gray(img):
    """Grayscale saja."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    return decode(gray, symbols=[ZBarSymbol.QRCODE])

def s_gray_contrast(img):
    """Grayscale + kontras +30%."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gray = cv2.convertScaleAbs(gray, alpha=1.3, beta=0)
    return decode(gray, symbols=[ZBarSymbol.QRCODE])

def s_clahe(img):
    """Grayscale + CLAHE (adaptive histogram equalization)."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
    gray = clahe.apply(gray)
    return decode(gray, symbols=[ZBarSymbol.QRCODE])

def s_otsu(img):
    """Grayscale + threshold Otsu (hitam-putih murni)."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    _, thr = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return decode(thr, symbols=[ZBarSymbol.QRCODE])

def s_adaptive(img):
    """Grayscale + adaptive threshold."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    thr = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                cv2.THRESH_BINARY, 21, 5)
    return decode(thr, symbols=[ZBarSymbol.QRCODE])

def s_sharpen(img):
    """Grayscale + unsharp mask."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (0, 0), 3)
    sharp = cv2.addWeighted(gray, 1.7, blur, -0.7, 0)
    return decode(sharp, symbols=[ZBarSymbol.QRCODE])

def s_upscale(img):
    """Upscale 1.5× lalu grayscale."""
    h, w = img.shape[:2]
    up = cv2.resize(img, (int(w * 1.5), int(h * 1.5)), interpolation=cv2.INTER_CUBIC)
    gray = cv2.cvtColor(up, cv2.COLOR_BGR2GRAY)
    return decode(gray, symbols=[ZBarSymbol.QRCODE])

def s_opencv_qr(img):
    """OpenCV's built-in QRCodeDetector — return pseudo-decoded result."""
    detector = cv2.QRCodeDetector()
    data, pts, _ = detector.detectAndDecode(img)
    if data:
        # bungkus jadi format mirip pyzbar agar konsisten
        class _Pseudo:
            pass
        p = _Pseudo()
        p.data = data.encode("utf-8")
        return [p]
    return []


STRATEGIES = [
    ("color           ", s_color),
    ("gray            ", s_gray),
    ("gray+contrast   ", s_gray_contrast),
    ("gray+clahe      ", s_clahe),
    ("gray+otsu       ", s_otsu),
    ("gray+adaptive   ", s_adaptive),
    ("gray+sharpen    ", s_sharpen),
    ("upscale 1.5x    ", s_upscale),
    ("opencv QRDetect ", s_opencv_qr),
]


# ──────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────

def find_images():
    exts = ("jpg", "jpeg", "png", "bmp", "webp")
    files = []
    for ext in exts:
        files += glob.glob(os.path.join(INPUT_DIR, f"*.{ext}"))
        files += glob.glob(os.path.join(INPUT_DIR, f"*.{ext.upper()}"))
    return sorted(set(files))


def main():
    if not os.path.isdir(INPUT_DIR):
        os.makedirs(INPUT_DIR, exist_ok=True)
        print(f"Folder dibuat: {INPUT_DIR}")
        print("Taruh foto-foto QR di sana lalu jalankan ulang script ini.")
        return

    images = find_images()
    if not images:
        print(f"Tidak ada gambar di {INPUT_DIR}")
        print("Taruh file .jpg/.png ke folder itu lalu jalankan ulang.")
        return

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print(f"Menguji {len(images)} foto dengan {len(STRATEGIES)} strategi...\n")

    # results[strategy_name] = list of (filename, detected_count, total_time_ms)
    results: dict[str, list] = {name: [] for name, _ in STRATEGIES}

    # Header tabel
    col_w = 20
    header = "FILE".ljust(36) + "".join(name[:14].ljust(16) for name, _ in STRATEGIES)
    print(header)
    print("-" * len(header))

    for path in images:
        img = cv2.imread(path)
        if img is None:
            print(f"  ⚠️  Gagal baca: {path}")
            continue

        fname_full = os.path.basename(path)
        fname = fname_full[:34]   # untuk display di tabel
        row = fname.ljust(36)
        annotated = img.copy()
        annotated_done = False

        for name, fn in STRATEGIES:
            t0 = time.perf_counter()
            try:
                decoded = fn(img)
            except Exception as e:
                decoded = []
                # print(f"  error {name.strip()} on {fname}: {e}")
            elapsed = (time.perf_counter() - t0) * 1000

            count = len(decoded)
            results[name].append((fname, count, elapsed))

            # Marker hasil
            marker = f"✓ {count} ({elapsed:.0f}ms)" if count else f"✗ ({elapsed:.0f}ms)"
            row += marker.ljust(16)

            # Annotate the output image dengan strategy pertama yang berhasil
            if count and not annotated_done:
                annotated_done = True
                for d in decoded:
                    try:
                        pts = d.polygon
                        if len(pts) == 4:
                            for j in range(4):
                                cv2.line(
                                    annotated,
                                    (pts[j].x, pts[j].y),
                                    (pts[(j + 1) % 4].x, pts[(j + 1) % 4].y),
                                    (0, 220, 120), 3,
                                )
                    except AttributeError:
                        pass  # opencv pseudo-result tidak punya polygon
                cv2.putText(annotated, f"Terdeteksi: {name.strip()}",
                            (15, 35), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 220, 120), 2)

        print(row)

        # Simpan annotated — pakai nama file lengkap dengan ekstensi
        out_path = os.path.join(OUTPUT_DIR, fname_full)
        cv2.imwrite(out_path, annotated)

    # ─── Summary ───
    print("\n" + "=" * 80)
    print("RINGKASAN")
    print("=" * 80)

    total = len(images)
    summary = []
    for name, _ in STRATEGIES:
        success = sum(1 for _, c, _ in results[name] if c > 0)
        avg_time = sum(t for _, _, t in results[name]) / max(len(results[name]), 1)
        rate = (success / total) * 100 if total else 0
        summary.append((name.strip(), success, total, rate, avg_time))

    summary.sort(key=lambda x: (-x[3], x[4]))  # urutkan: success rate desc, lalu waktu asc
    print(f"\n{'STRATEGI':<20} {'BERHASIL':>10} {'RATE':>10} {'AVG TIME':>12}")
    print("-" * 56)
    for name, success, total, rate, avg_time in summary:
        bar = "█" * int(rate / 5)
        print(f"{name:<20} {success}/{total:<10} {rate:>6.1f}%   {avg_time:>7.0f}ms  {bar}")

    best = summary[0]
    print(f"\n🏆 Terbaik: \x1b[32m{best[0]}\x1b[0m — {best[1]}/{best[2]} ({best[3]:.0f}%) "
          f"rata-rata {best[4]:.0f}ms")
    print(f"\nFoto annotated tersimpan di: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
