#!/usr/bin/env python
"""
validate.py — sanity-check data/vocab.json and the rendered audio pack.

Run this after editing vocabulary, before rebuilding audio:

    python tools/validate.py

These are the mistakes that silently ruin a game: two objects that draw
the same picture, a "real or fake" distractor identical to the answer, a
colour word with no swatch, a clip that was never rendered.
"""
from __future__ import annotations

import json
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VOCAB = ROOT / "data" / "vocab.json"
MANIFEST = ROOT / "audio" / "manifest.js"

errors: list[str] = []
warnings: list[str] = []


def err(msg: str) -> None:
    errors.append(msg)


def warn(msg: str) -> None:
    warnings.append(msg)


def visible(emoji: str) -> str:
    """Strip variation selectors: U+1FA91 and U+1FA91+FE0F draw the same."""
    return "".join(c for c in unicodedata.normalize("NFC", emoji) if c not in "\uFE0E\uFE0F")


def main() -> int:
    vocab = json.loads(VOCAB.read_text(encoding="utf-8"))

    # ---- letters ----
    alpha = vocab.get("letters", {}).get("alphabet", "")
    if len(alpha) != 26:
        err(f"letters.alphabet should be 26 letters, found {len(alpha)}")
    sounds = vocab.get("letters", {}).get("sounds", {})
    for ch in alpha:
        if ch not in sounds:
            err(f"no phonics sound defined for letter '{ch}'")

    # ---- colours ----
    colors = vocab.get("topics", {}).get("colors", {})
    swatches = colors.get("swatches", {})
    for w in colors.get("words", []):
        if w not in swatches:
            err(f"colour '{w}' has no swatch")
        if not re.fullmatch(r"#[0-9a-fA-F]{6}", swatches.get(w, "")):
            err(f"colour '{w}' has a malformed swatch: {swatches.get(w)!r}")
    dup_hex = defaultdict(list)
    for name, hexv in swatches.items():
        dup_hex[hexv.lower()].append(name)
    for hexv, names in dup_hex.items():
        if len(names) > 1:
            err(f"colours {names} all use the same swatch {hexv} — they would be indistinguishable")

    # ---- classroom items ----
    items = vocab.get("topics", {}).get("classroom", {}).get("items", [])
    words = [i["word"] for i in items]
    for dup, n in Counter(words).items():
        if n > 1:
            err(f"classroom word '{dup}' is listed {n} times")

    by_pic: dict[str, list[str]] = defaultdict(list)
    for i in items:
        by_pic[visible(i["emoji"])].append(i["word"])
    for pic, group in by_pic.items():
        if len(group) > 1:
            err(
                f"classroom objects {group} use the same picture — a pupil could not tell "
                f"them apart in the listening game"
            )

    for i in items:
        c = i.get("confusable")
        if c and visible(c) == visible(i["emoji"]):
            err(f"'{i['word']}' has a lookalike identical to its own picture — the Real or Fake level would be unanswerable")
        if not c:
            warn(f"'{i['word']}' has no lookalike, so it is skipped by the Real or Fake level")
        if not i.get("desc"):
            warn(f"'{i['word']}' has no clue, so it is skipped by the What Is It level")
        if not i.get("place"):
            warn(f"'{i['word']}' has no place, so it is skipped by Where Does It Go")

    # the place level needs enough distinct locations to build 4 options
    places = {i["place"] for i in items if i.get("place")}
    if len(places) < 4:
        err(f"only {len(places)} distinct locations; Where Does It Go needs at least 4")

    # ---- audio pack ----
    if not MANIFEST.exists():
        err("audio/manifest.js is missing — run: python tools/build_audio.py")
    else:
        text = MANIFEST.read_text(encoding="utf-8")
        # Grab the object literal assigned to LG.AUDIO_MANIFEST. A plain
        # text.index("{") would match the {} in the "window.LG || {}" line.
        m = re.search(r"LG\.AUDIO_MANIFEST\s*=\s*(\{.*\})\s*;", text, re.S)
        if not m:
            err("audio/manifest.js does not assign LG.AUDIO_MANIFEST")
            m = None
        manifest = json.loads(m.group(1)) if m else {}

        if manifest:
            for i in items:
                for key in (f"word/{i['word']}", f"spell/{i['word']}"):
                    if key not in manifest:
                        err(f"no audio clip for '{key}' - run: python tools/build_audio.py --force")
            for w in colors.get("words", []):
                if f"word/{w}" not in manifest:
                    err(f"no audio clip for 'word/{w}'")
            for n in vocab.get("topics", {}).get("numbers", {}).get("words", []):
                if f"word/{n}" not in manifest:
                    err(f"no audio clip for 'word/{n}'")

            # files referenced must actually exist
            missing_files = [v for v in manifest.values() if not (ROOT / v).exists()]
            if missing_files:
                err(f"{len(missing_files)} manifest entries point at files that do not exist, "
                    f"e.g. {missing_files[:3]}")

            # and the reverse: rendered files nothing references
            on_disk = {
                str(p.relative_to(ROOT)).replace("\\", "/")
                for p in (ROOT / "audio").rglob("*.mp3")
            }
            orphans = sorted(on_disk - set(manifest.values()))
            if orphans:
                warn(f"{len(orphans)} rendered clips are not referenced by the manifest "
                     f"(harmless, but they bloat the repo): {orphans[:3]}")

            total = sum((ROOT / v).stat().st_size for v in manifest.values() if (ROOT / v).exists())
            print(f"audio pack: {len(manifest)} clips, {total / 1_048_576:.2f} MB")

    print(f"vocabulary: {len(items)} classroom objects, {len(colors.get('words', []))} colours, "
          f"{len(places)} locations")

    for w in warnings:
        print("  warning:", w)
    for e in errors:
        print("  ERROR:", e)

    if errors:
        print(f"\n{len(errors)} problem(s) found.")
        return 1
    print("\nAll checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
