#!/usr/bin/env bash
# absen.sh - Simulasi absen tanpa kamera: tembak /api/attendance lalu gerakkan
# servo kunci sesuai role (meniru yang dilakukan scanner.py / app.py).
#
# Pakai:
#   ./absen.sh U-YHA8            # bin default (BIN_CODE)
#   ./absen.sh U-XY6J B-W892     # tentukan bin
#
# Syarat: backend (npm run dev :3000) & api_server.py (:5000) sama-sama jalan.

set -euo pipefail

USER_CODE="${1:-}"
BIN_CODE="${2:-B-W892}"
BACKEND="${BACKEND:-http://localhost:3000}"
SERVO="${SERVO:-http://localhost:5000}"
TOKEN="${SCANNER_API_TOKEN:-7r981nrh2u9hr298r893}"

if [[ -z "$USER_CODE" ]]; then
  echo "Pakai: $0 <USER_CODE> [BIN_CODE]   contoh: $0 U-YHA8"
  exit 1
fi

echo "[absen] $USER_CODE @ $BIN_CODE"
RESP=$(curl -s -X POST "$BACKEND/api/attendance" \
  -H "Content-Type: application/json" \
  -H "X-Scanner-Token: $TOKEN" \
  -d "{\"userCode\":\"$USER_CODE\",\"binCode\":\"$BIN_CODE\"}")
echo "  -> $RESP"

# Ambil userRole dari JSON respons (tanpa perlu jq)
ROLE=$(echo "$RESP" | grep -o '"userRole":"[^"]*"' | cut -d'"' -f4)
OK=$(echo "$RESP" | grep -o '"ok":true' || true)

if [[ -z "$OK" ]]; then
  echo "  [servo] absen GAGAL -> servo tidak digerakkan."
  exit 1
fi
if [[ -z "$ROLE" ]]; then
  echo "  [servo] role kosong -> servo tidak digerakkan."
  exit 1
fi

echo "[servo] toggle kunci role=$ROLE"
curl -s -X POST "$SERVO/lock/$ROLE"
echo ""
