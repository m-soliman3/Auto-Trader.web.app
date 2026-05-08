import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

LANG_BATCHES = [
    ("ar", ["ar-learn-pages-1-20.json", "ar-learn-pages-21-40.json"]),
    ("fr", ["fr-learn-pages-1-20.json", "fr-learn-pages-21-40.json"]),
    ("es", ["es-learn-pages-1-20.json", "es-learn-pages-21-40.json"]),
    ("pt", ["pt-learn-pages-1-20.json", "pt-learn-pages-21-40.json"]),
]

for lang, batches in LANG_BATCHES:
    target_path = os.path.join(ROOT, "public", "i18n", f"{lang}.json")
    with open(target_path, encoding="utf-8") as f:
        data = json.load(f)
    if "learnPages" not in data:
        data["learnPages"] = {}
    for batch_file in batches:
        batch_path = os.path.join(ROOT, "scripts", batch_file)
        with open(batch_path, encoding="utf-8") as f:
            pages = json.load(f)
        for slug, content in pages.items():
            if slug not in data["learnPages"]:
                data["learnPages"][slug] = content
    with open(target_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"{lang}: {len(data['learnPages'])} learnPages")
