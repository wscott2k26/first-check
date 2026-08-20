#!/usr/bin/env bash
set -euo pipefail

# Stable runtime gate for the exact emergency 1.0.1 / code-3 AAB.
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

handle_android_dialogs() {
  local n xml result action x y title
  for n in 1 2 3 4 5 6; do
    xml="/tmp/android-system-dialog-${API}-${n}.xml"
    dump_ui "$xml"
    result="$(python3 ci/android_dialog_action.py "$xml")"
    IFS=$'\t' read -r action x y title <<< "$result"

    case "$action" in
      none)
        return 0
        ;;
      first-check)
        echo "FAIL: First Check-specific Android crash/ANR dialog is visible: $title"
        cat "$xml" || true
        return 31
        ;;
      wait|close|ok)
        echo "Unrelated Android/emulator dialog detected: $title; action=$action"
        adb shell input tap "$x" "$y" || true
        sleep 8
        ;;
      blocked)
        echo "INVALID ENVIRONMENT: unrelated Android dialog cannot be safely dismissed: $title"
        cat "$xml" || true
        return 32
        ;;
      *)
        echo "INVALID ENVIRONMENT: unknown dialog classifier result: $result"
        cat "$xml" || true
        return 33
        ;;
    esac
  done

  dump_ui "/tmp/android-system-dialog-${API}-final.xml"
  result="$(python3 ci/android_dialog_action.py "/tmp/android-system-dialog-${API}-final.xml")"
  IFS=$'\t' read -r action x y title <<< "$result"
  if [[ "$action" != "none" ]]; then
    echo "INVALID ENVIRONMENT: Android dialog remains after repeated safe handling: $title"
    return 32
  fi
}

# Regression pin for the exact false-positive patterns seen in the hosted emulators.
python3 ci/test_android_dialog_action.py

echo "=== API $API emulator settle ==="
# Intel hosted emulators can report boot-complete while framework services are still catching up.
sleep 35
adb shell input keyevent KEYCODE_HOME || true
sleep 5
handle_android_dialogs

echo "=== Install exact 1.0.1 code-3 APK ==="
adb install -r "$APK"
adb shell pm clear "$PKG" >/dev/null || true
# Installation is intentionally followed by a settle window because hosted Android system services
# can throw their own ANR/crash dialogs while First Check remains healthy.
sleep 45
handle_android_dialogs

for i in 1 2 3 4 5; do
  echo "=== FIRST CHECK STABLE COLD LAUNCH $i / API $API ==="
  adb logcat -c
  adb shell am force-stop "$PKG"
  adb shell am start -n "$ACTIVITY" | tee "/tmp/first-check-v101-start-${API}-${i}.txt"
  sleep 20

  handle_android_dialogs

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

  # UiAutomator dumps the currently interactive window. After unrelated Android dialogs have been
  # safely removed, requiring the current UI hierarchy itself to belong to First Check is a more
  # reliable foreground proof on Android 15/16 than legacy dumpsys-window focus fields.
  if ! grep -q "package=\"$PKG\"" "$UI"; then
    echo 'FAIL: the current interactive window does not belong to First Check.'
    cat "$UI" || true
    adb shell dumpsys activity activities | grep -E 'topResumedActivity|mResumedActivity' || true
    exit 26
  fi
done

adb exec-out screencap -p > "$SCREEN"
echo "PASS: exact First Check 1.0.1 code-3 AAB payload survived 5 stabilized cold launches on API $API with branded sign-in visible."
