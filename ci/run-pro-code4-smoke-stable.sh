#!/usr/bin/env bash
set -euo pipefail

API="${1:?API level required}"
APK="${2:?APK path required}"
PKG='com.stormandme.firstcheck'
ACTIVITY='com.stormandme.firstcheck/.MainActivity'
LOG="/tmp/first-check-pro-code4-api-${API}.logcat.txt"
UI="/tmp/first-check-pro-code4-api-${API}.ui.xml"
SCREEN="/tmp/first-check-pro-code4-api-${API}.png"
: > "$LOG"

dump_ui() {
  local out="$1"
  adb shell uiautomator dump --compressed /sdcard/first-check-window.xml >/dev/null 2>&1 || true
  adb shell cat /sdcard/first-check-window.xml > "$out" 2>/dev/null || true
}

handle_android_dialogs() {
  local n xml result action x y title
  for n in 1 2 3 4 5 6; do
    xml="/tmp/pro-code4-android-system-dialog-${API}-${n}.xml"
    dump_ui "$xml"
    result="$(python3 ci/android_dialog_action.py "$xml")"
    IFS=$'\t' read -r action x y title <<< "$result"
    case "$action" in
      none) return 0 ;;
      first-check)
        echo "FAIL: First Check-specific Android crash/ANR dialog is visible: $title"
        return 31
        ;;
      wait|close|ok)
        echo "Unrelated Android/emulator dialog detected: $title; action=$action"
        adb shell input tap "$x" "$y" || true
        sleep 8
        ;;
      blocked)
        echo "INVALID ENVIRONMENT: unrelated Android dialog cannot be safely dismissed: $title"
        return 32
        ;;
      *)
        echo "INVALID ENVIRONMENT: unknown dialog classifier result: $result"
        return 33
        ;;
    esac
  done
  return 32
}

python3 ci/test_android_dialog_action.py

echo "=== API $API emulator settle ==="
sleep 35
adb shell input keyevent KEYCODE_HOME || true
sleep 5
handle_android_dialogs

echo "=== Install exact First Check Pro 1.1.0 code-4 APK ==="
adb install -r "$APK"
adb shell pm clear "$PKG" >/dev/null || true
sleep 45
handle_android_dialogs

for i in 1 2 3 4 5; do
  echo "=== FIRST CHECK PRO COLD LAUNCH $i / API $API ==="
  adb logcat -c
  adb shell am force-stop "$PKG"
  adb shell am start -n "$ACTIVITY" | tee "/tmp/first-check-pro-code4-start-${API}-${i}.txt"
  sleep 20
  handle_android_dialogs

  PID="$(adb shell pidof "$PKG" | tr -d '\r')"
  echo "First Check PID=$PID"
  if [[ -z "$PID" ]]; then
    echo "FAIL: First Check process died after cold launch $i on API $API"
    adb logcat -d -v threadtime >> "$LOG" || true
    exit 21
  fi

  CURRENT="/tmp/first-check-pro-code4-current-${API}-${i}.log"
  FULL="/tmp/first-check-pro-code4-full-${API}-${i}.log"
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
    exit 24
  fi
  if ! grep -qE 'Sign in to First Check|Secure workspace access|Start the day knowing' "$UI"; then
    echo 'FAIL: polished First Check sign-in screen was not visible.'
    cat "$UI" || true
    exit 25
  fi

done

adb exec-out screencap -p > "$SCREEN"
echo "PASS: exact First Check Pro 1.1.0 code-4 AAB payload survived 5 stabilized cold launches on API $API with branded sign-in visible."
