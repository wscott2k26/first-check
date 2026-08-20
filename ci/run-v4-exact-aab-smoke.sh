#!/usr/bin/env bash
set -euo pipefail

API="${1:?api level required}"
PKG="com.stormandme.firstcheck"
APK="/tmp/v4apks/universal.apk"
LOG="/tmp/first-check-v4-api-${API}.logcat.txt"
SCREEN="/tmp/first-check-v4-api-${API}.png"

: > "$LOG"
adb install -r "$APK"
adb shell pm clear "$PKG" >/dev/null || true

for i in 1 2 3 4 5; do
  echo "=== COLD LAUNCH ${i} / API ${API} ==="
  adb logcat -c
  adb shell am force-stop "$PKG"
  adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null
  sleep 8
  adb logcat -d -v threadtime >> "$LOG"

  PID="$(adb shell pidof "$PKG" | tr -d '\r' || true)"
  echo "PID=$PID"

  if [[ -z "$PID" ]]; then
    echo "FAIL: First Check process died on launch $i"
    grep -E -A120 -B30 'FATAL EXCEPTION|Fatal signal|Process: com\.stormandme\.firstcheck|NoSuchMethodError|AndroidRuntime' "$LOG" | tail -n 600 || true
    exit 21
  fi

  if grep -qE 'FATAL EXCEPTION|Fatal signal|Process: com\.stormandme\.firstcheck|NoSuchMethodError' "$LOG"; then
    echo "FAIL: fatal crash signature on launch $i"
    grep -E -A120 -B30 'FATAL EXCEPTION|Fatal signal|Process: com\.stormandme\.firstcheck|NoSuchMethodError|AndroidRuntime' "$LOG" | tail -n 600 || true
    exit 22
  fi
done

adb exec-out screencap -p > "$SCREEN"
echo "RUNTIME_SMOKE=PASS API=${API}"
