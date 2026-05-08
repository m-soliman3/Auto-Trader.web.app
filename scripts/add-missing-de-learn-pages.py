#!/usr/bin/env python3
"""
Merges missing German learn-page translations into public/i18n/de.json.

Usage (run from project root):
    python3 scripts/add-missing-de-learn-pages.py
"""

import json
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(SCRIPT_DIR)

DE_PATH = os.path.join(ROOT, "public", "i18n", "de.json")
TRANSLATIONS_PATH = os.path.join(SCRIPT_DIR, "de-learn-pages-translations.json")

with open(DE_PATH, encoding="utf-8") as f:
    de = json.load(f)

with open(TRANSLATIONS_PATH, encoding="utf-8") as f:
    new_pages = json.load(f)

if "learnPages" not in de:
    de["learnPages"] = {}

added, skipped = [], []
for slug, data in new_pages.items():
    if slug in de["learnPages"]:
        skipped.append(slug)
    else:
        de["learnPages"][slug] = data
        added.append(slug)

with open(DE_PATH, "w", encoding="utf-8") as f:
    json.dump(de, f, ensure_ascii=False, indent=2)
    f.write("\n")

print(f"Added   ({len(added)}): {added}")
print(f"Skipped ({len(skipped)}): {skipped}")
print("Done — de.json updated.")
