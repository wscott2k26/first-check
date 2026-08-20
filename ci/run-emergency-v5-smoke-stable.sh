#!/usr/bin/env bash
set -euo pipefail

API="${1:?API level required}"
APK="${2:-/tmp/emergency-v5/universal.apk}"
PKG='com.stormandme.firstcheck'
ACTIVITY='com.stormandme.firstcheck/.MainActivity'
LOG="/tmp/first-check-v101-stable-api-${API}.logcat.txt"
UI="/tmp/first-check-v101-stable-api-${API}.ui.xml"
SCREEN="/tmp/first-check-v101-stable-api-${API}.png"
: > "$LOG"

dump_ui() {
  local out="$1"
  adb shell uiautomator dump --compressed /sdcard/first-check-window.xml >/dev/null 2>&1 || true
  adb shell cat /sdcard/first-check-window.xml > "$out" 2>/dev/null || true
}

dismiss_system_anr_only() {
  local n xml coords x y
  for n in 1 2 3; do
    xml="/tmp/android-system-dialog-${API}-${n}.xml"
    dump_ui "$xml"
    if grep -qE 'First Check (isn.t responding|keeps stopping)|com\.stormandme\.firstcheck' "$xml"; then
      echo 'FAIL: First Check-specific Android crash/ANR dialog is visible.'
      cat "$xml" || true
      return 31
    fi
    if ! grep -q 'Process system isn.t responding' "$xml"; then
      return 0
    fi
    echo 'Emulator system-process ANR detected; choosing Wait (not closing First Check).'
    coords="$(python3 - "$xml" <<'PY'
import re,sys
s=open(sys.argv[1],encoding='utf-8',errors='ignore').read()
m=re.search(r'text="Wait"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"',s)
if not m:
    m=re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*text="Wait"',s)
if m:
    a,b,c,d=map(int,m.groups()); print((a+c)//2,(b+d)//2)
PY
)"
    if [[ -n "$coords" ]]; then
      read -r x y <<<"$coords"
      adb shell input tap "$x" "$y" || true
    else
      adb shell input keyevent 61 || true
      adb shell input keyevent 66 || true
    fi
    sleep 12
  done
  dump_ui "/tmp/android-system-dialog-${API}-final.xml"
  if grep -q 'Process system isn.t responding' "/tmp/android-system-dialog-${API}-final.xml"; then
    echo 'INVALID ENVIRONMENT: Android system process remains ANR after Wait.'
    return 32
  fi
}

echo "=== API $API emulator settle ==="
# The Intel hosted emulator can report boot-complete while framework services are still catching up.
sleep 35
adb shell input keyevent KEYCODE_HOME || true
sleep 5
dismiss_system_anr_only

echo "=== Install exact 1.0.1 code-3 APK ==="
adb install -r "$APK"
adb shell pm clear "$PKG" >/dev/null || true
# Installation is intentionally followed by a settle window; the prior run showed Android's own
# system process ANR immediately after a very slow streamed install while First Check stayed alive.
sleep 45
dismiss_system_anr_only

for i in 1 2 3 4 5; do
  echo "=== FIRST CHECK STABLE COLD LAUNCH $i / API $API ==="
  adb logcat -c
  adb shell am force-stop "$PKG"
  adb shell am start -n "$ACTIVITY" | tee "/tmp/first-check-v101-start-${API}-${i}.txt"
  sleep 20

  dismiss_system_anr_only

  PID="$(adb shell pidof "$PKG" | tr -d '\r')"
  echo "First Check PID=$PID"
  if [[ -z "$PID" ]]; then
    echo "FAIL: First Check process died after cold launch $i on API $API"
    adb logcat -d -v threadtime >> "$LOG" || true
    exit 21
  fi

  CURRENT="/tmp/first-check-v101-current-${API}-${i}.log"
  FULL="/tmp/first-check-v101-full-${API}-${i}.log"
  adb logcat -d --pid="$PID" -v threadtime > "$CURRENT" || true
  cat "$CURRENT" >> "$LOG"
  adb logcat -d -v threadtime > "$FULL" || true

  if grep -qE 'FATAL EXCEPTION|Fatal signal|NoSuchMethodError|UnsatisfiedLinkError' "$CURRENT"; then
    echo "FAIL: fatal signature exists inside First Check process log on launch $i"
    exit 22
  fi
  if grep -qE 'Process: com\.stormandme\.firstcheck|>>> com\.stormandme\.firstcheck <<<|ANR in com\.stormandme\.firstcheck' "$FULL"; then
    echo "FAIL: Android recorded a First Check crash/ANR on launch $i"
    exit 23
  fi

  dump_ui "$UI"
  if grep -qE 'Page could not be found|firstcheck:///' "$UI"; then
    echo 'FAIL: clean launch lands on Expo Router unmatched-route UI.'
    cat "$UI" || true
    exit 24
  fi
  if ! grep -qE 'Sign in to First Check|Secure workspace access|Start the day knowing' "$UI"; then
    echo 'FAIL: polished First Check sign-in screen was not visible.'
    cat "$UI" || true
    exit 25
  fi

  if ! adb shell dumpsys window windows | grep -E 'mCurrentFocus|mFocusedApp' | grep -q "$PKG"; then
    echo 'FAIL: First Check is alive but not foreground after the stabilized launch.'
    exit 26
  fi

done

adb exec-out screencap -p > "$SCREEN"
echo "PASS: exact First Check 1.0.1 code-3 AAB payload survived 5 stabilized cold launches on API $API with branded sign-in visible."
