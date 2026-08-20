#!/usr/bin/env python3
from __future__ import annotations

import re
import sys
import xml.etree.ElementTree as ET

FIRST_CHECK_FAILURE_PHRASES = (
    "isn't responding",
    "is not responding",
    "keeps stopping",
    "has stopped",
    "stopped working",
)


def _center(bounds: str):
    match = re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", bounds or "")
    if not match:
        return None
    x1, y1, x2, y2 = map(int, match.groups())
    return (x1 + x2) // 2, (y1 + y2) // 2


def classify(xml_text: str):
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return "none", "", "", ""

    nodes = list(root.iter("node"))
    title = ""
    for node in nodes:
        if node.attrib.get("resource-id") == "android:id/alertTitle":
            title = node.attrib.get("text", "")
            break

    if not title:
        return "none", "", "", ""

    lowered = title.lower()
    if "first check" in lowered and any(phrase in lowered for phrase in FIRST_CHECK_FAILURE_PHRASES):
        return "first-check", "", "", title

    for button_text, action in (("Wait", "wait"), ("Close app", "close"), ("OK", "ok")):
        for node in nodes:
            if node.attrib.get("text") == button_text:
                point = _center(node.attrib.get("bounds", ""))
                if point:
                    return action, point[0], point[1], title

    return "blocked", "", "", title


def main():
    if len(sys.argv) != 2:
        raise SystemExit("usage: android_dialog_action.py <uiautomator.xml>")
    xml_text = open(sys.argv[1], encoding="utf-8", errors="ignore").read()
    action, x, y, title = classify(xml_text)
    print("\t".join((str(action), str(x), str(y), str(title))))


if __name__ == "__main__":
    main()
