#!/usr/bin/env python3
import importlib.util
from pathlib import Path

HERE = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("android_dialog_action", HERE / "android_dialog_action.py")
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(MODULE)


def check(xml_text, expected_action, expected_xy=None):
    action, x, y, _title = MODULE.classify(xml_text)
    assert action == expected_action, (action, expected_action)
    if expected_xy is not None:
        assert (x, y) == expected_xy, ((x, y), expected_xy)


check(
    '<hierarchy><node package="com.stormandme.firstcheck"><node text="First Check"/><node text="Sign in to First Check"/></node></hierarchy>',
    "none",
)
check(
    '<hierarchy><node package="android"><node text="First Check isn\'t responding" resource-id="android:id/alertTitle"/><node text="Wait" bounds="[70,1328][1010,1454]"/></node></hierarchy>',
    "first-check",
)
check(
    '<hierarchy><node package="android"><node text="System UI isn\'t responding" resource-id="android:id/alertTitle"/><node text="Wait" bounds="[70,1269][1010,1395]"/></node></hierarchy>',
    "wait",
    (540, 1332),
)
check(
    '<hierarchy><node package="android"><node text="Bluetooth keeps stopping" resource-id="android:id/alertTitle"/><node text="Close app" bounds="[70,1269][1010,1395]"/></node></hierarchy>',
    "close",
    (540, 1332),
)

print("PASS: Android dialog classifier distinguishes First Check failures from unrelated emulator dialogs.")
