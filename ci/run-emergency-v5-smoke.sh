#!/usr/bin/env bash
set -euo pipefail

API="${1:?API level required}"
APK="${2:-/tmp/emergency-v5/universal.apk}"
PKG='com.stormandme.firstcheck'
ACTIVITY='com.stormandme.firstcheck/.MainActivity'
LOG="/tmp/first-check-emergency-v5-api-${API}.logcat.txt"
UI="/tmp/first-check-emergency-v5-api-${API}.ui.xml"
SCREEN="/tmp/first-check-emergency-v5-api-${API}.png"
: > "$LOG"

adb install -r "$APK"
adb shell pm clear "$PKG" >/dev/null || true

for i in 1 2 3 4 5; do
  echo "=== FIRST CHECK COLD LAUNCH $i / API $API ==="
  adb logcat -c
  adb shell am force-stop "$PKG"
  adb shell am start -W -n "$ACTIVITY" | tee "/tmp/first-check-start-${API}-${i}.txt"
  sleep 12

  PID="$(adb shell pidof "$PKG" | tr -d '\r')"
  echo "First Check PID=$PID"
  if [[ -z "$PID" ]]; then
    echo "FAIL: First Check process died after cold launch $i on API $API"
    adb logcat -d -v threadtime >> "$LOG" || true
    exit 21
  fi

  # App-scoped logcat prevents unrelated Android system-process crashes from creating false failures.
  adb logcat -d --pid="$PID" -v threadtime > "/tmp/first-check-current-${API}-${i}.log" || true
  cat "/tmp/first-check-current-${API}-${i}.log" >> "$LOG"
  FULL="/tmp/first-check-full-${API}-${i}.log"
  adb logcat -d -v threadtime > "$FULL" || true

  if grep -qE 'FATAL EXCEPTION|Fatal signal|NoSuchMethodError|UnsatisfiedLinkError' "/tmp/first-check-current-${API}-${i}.log"; then
    echo "FAIL: fatal signature exists inside the First Check process log on launch $i"
    exit 22
  fi
  if grep -qE 'Process: com\.stormandme\.firstcheck|>>> com\.stormandme\.firstcheck <<<' "$FULL"; then
    echo "FAIL: Android recorded a First Check crash on launch $i"
    exit 23
  fi

  adb shell uiautomator dump --compressed /sdcard/first-check-window.xml >/dev/null 2>&1 || true
  adb shell cat /sdcard/first-check-window.xml > "$UI" 2>/dev/null || true
  if grep -qE 'Page could not be found|firstcheck:///' "$UI"; then
    echo "FAIL: clean launch still lands on Expo Router unmatched-route UI"
    exit 24
  fi
  if ! grep -qE 'Sign in to First Check|Secure workspace access|Start the day knowing' "$UI"; then
    echo "FAIL: polished First Check sign-in screen was not visible after launch $i"
    cat "$UI" || true
    exit 25
  fi

  if ! adb shell dumpsys window windows | grep -E 'mCurrentFocus|mFocusedApp' | grep -q "$PKG"; then
    echo "FAIL: First Check is alive but not the focused app after launch $i"
    exit 26
  fi

done

adb exec-out screencap -p > "$SCREEN"
echo "PASS: First Check 1.0.1 survived 5 cold launches on API $API and rendered the branded sign-in experience."
