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


def _extract(text: str, name: str) -> dict:
    """Pull a JSON object assigned to `name` out of a generated JS file.

    Brace-counting rather than a regex: the file assigns more than one
    object, so a non-greedy pattern would stop at the first `};` and a
    greedy one would swallow the rest of the file.
    """
    m = re.search(re.escape(name) + r"\s*=\s*", text)
    if not m:
        return {}
    start = text.find("{", m.end())
    if start == -1:
        return {}
    depth = 0
    in_str = False
    esc = False
    for i in range(start, len(text)):
        c = text[i]
        if in_str:
            if esc:
                esc = False
            elif c == "\\":
                esc = True
            elif c == '"':
                in_str = False
            continue
        if c == '"':
            in_str = True
        elif c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(text[start:i + 1])
                except json.JSONDecodeError:
                    return {}
    return {}


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
        manifest = _extract(text, "LG.AUDIO_MANIFEST")
        if not manifest:
            err("audio/manifest.js does not assign a readable LG.AUDIO_MANIFEST")
        durations = _extract(text, "LG.AUDIO_DURATIONS")
        variants = _extract(text, "LG.AUDIO_VARIANTS")

        if manifest:
            # The definitive list of clips comes from the builder itself, so
            # this file cannot fall behind when a topic introduces a new
            # kind of vocabulary (plurals, names, instructions and so on).
            expected: set = set()
            try:
                import importlib.util

                spec = importlib.util.spec_from_file_location(
                    "build_audio", ROOT / "tools" / "build_audio.py"
                )
                mod = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(mod)
                expected = {c["key"] for c in mod.build_clips(vocab, ", ", False)}
            except Exception as exc:                       # noqa: BLE001
                err(f"could not ask tools/build_audio.py what clips to expect: {exc}")

            for key in sorted(expected):
                if key not in manifest:
                    err(f"no audio clip for '{key}' - run: python tools/build_audio.py")
            print(f"expected {len(expected)} clips, manifest has {len(manifest)}")

            # Clip keys are lower-cased so they match what the game asks for
            # (LG.Q.wordKey lower-cases its argument). An upper-case key here
            # means a level requests a key that will never resolve, and the
            # game quietly falls back to Web Speech for that word.
            shouty = [k for k in manifest if k != k.lower()]
            if shouty:
                err(f"{len(shouty)} clip keys contain capitals and will never match a "
                    f"request, e.g. {shouty[:3]}")

            # files referenced must actually exist
            missing_files = [v for v in manifest.values() if not (ROOT / v).exists()]
            if missing_files:
                err(f"{len(missing_files)} manifest entries point at files that do not exist, "
                    f"e.g. {missing_files[:3]}")

            # and the reverse: rendered files nothing references. Variant
            # clips are referenced too, so count them as used.
            referenced = set(manifest.values())
            for table in (variants or {}).values():
                referenced.update(table.values())
            on_disk = {
                str(p.relative_to(ROOT)).replace("\\", "/")
                for p in (ROOT / "audio").rglob("*.mp3")
            }
            orphans = sorted(on_disk - referenced)
            if orphans:
                warn(f"{len(orphans)} rendered clips are not referenced by the manifest "
                     f"(harmless, but they bloat the repo): {orphans[:3]}")

            total = sum((ROOT / v).stat().st_size for v in manifest.values() if (ROOT / v).exists())
            print(f"audio pack: {len(manifest)} clips, {total / 1_048_576:.2f} MB")

            # The duration map is optional, but if it is present it must
            # line up with the manifest or the repeat heuristic is guessing.
            if durations:
                missing_dur = set(manifest) - set(durations)
                if missing_dur:
                    warn(f"{len(missing_dur)} clips have no recorded duration, so they will "
                         f"always use the normal repeat count")
                bogus = [k for k, v in durations.items() if not isinstance(v, (int, float)) or v <= 0]
                if bogus:
                    err(f"durations contain invalid values, e.g. {bogus[:3]}")
            else:
                warn("no LG.AUDIO_DURATIONS in the manifest; long prompts will not be capped")

            # ---- alternative voices ----
            for name, table in (variants or {}).items():
                if not isinstance(table, dict) or not table:
                    err(f"variant '{name}' is empty; remove the folder or render some clips")
                    continue
                for k, path in table.items():
                    if k not in manifest:
                        err(f"variant '{name}' covers '{k}', which is not in the main manifest")
                    if not (ROOT / path).exists():
                        err(f"variant '{name}' points at a missing file: {path}")
                print(f"variant '{name}': {len(table)} alternative clips")

            # variant folders present on disk but not in the manifest would
            # be deployed but unreachable
            vdir = ROOT / "audio" / "variants"
            if vdir.is_dir():
                for sub in sorted(p for p in vdir.iterdir() if p.is_dir()):
                    if sub.name not in (variants or {}):
                        warn(f"audio/variants/{sub.name}/ exists but is not in the manifest, "
                             f"so the game cannot use it")

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
