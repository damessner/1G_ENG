#!/usr/bin/env python
"""
build_audio.py — pre-render every word in data/vocab.json into MP3 clips
and emit the manifest + browser data file.

    python tools/build_audio.py              # generate anything missing
    python tools/build_audio.py --check      # report gaps, generate nothing
    python tools/build_audio.py --only colors --force
    python tools/build_audio.py --sounds     # also render phonics-sound spelling

Why pre-render instead of live Web Speech?
  * identical voice on every device
  * works on machines with no English TTS voice installed
  * no synthesis delay, works fully offline once deployed
The game falls back to Web Speech automatically for any clip that is missing.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VOCAB = ROOT / "data" / "vocab.json"
AUDIO = ROOT / "audio"
MANIFEST = AUDIO / "manifest.js"
BROWSER_DATA = ROOT / "js" / "data" / "vocab.js"

# UI clip key -> the words the voice should say
UI_LINES = {
    "correct": "Yes! Well done!",
    "wrong": "Try again",
    "levelComplete": "Level complete!",
    "levelUp": "New level unlocked!",
    "badge": "New badge!",
    "listenAgain": "Listen again",
    "tapToHear": "Tap to hear",
    "youScored": "You scored",
    "tryAgain": "Try again",
}

SAFE = re.compile(r"[^a-z0-9]+")


def slug(text: str) -> str:
    s = SAFE.sub("_", text.lower()).strip("_")
    return s or "x"


def unique(base: str, used: set) -> str:
    name, i = base, 2
    while name in used:
        name = f"{base}_{i}"
        i += 1
    used.add(name)
    return name


def build_clips(vocab: dict, spell_join: str, with_sounds: bool) -> list[dict]:
    """Expand the vocabulary into a flat list of clips to render."""
    used: dict = {}          # group -> names already taken in that group
    keys: set = set()        # clip keys, so a word in two lists is not rendered twice
    clips: list[dict] = []

    def add(key: str, text: str, group: str):
        if key in keys:
            return                    # e.g. "light" appears in blend and long
        keys.add(key)
        # Dedupe per group, so words/alphabet/cat.mp3 and
        # spell/alphabet/cat.mp3 can coexist without a _2 suffix.
        seen = used.setdefault(group, set())
        fname = unique(slug(key.split("/", 1)[-1]), seen)
        clips.append(
            {"key": key, "text": text, "file": f"{group}/{fname}.mp3", "group": group}
        )

    # ---- letters: name + phonics sound -------------------------------------
    for ch in vocab.get("letters", {}).get("alphabet", ""):
        add(f"letter/name/{ch}", ch, "letters")
        snd = vocab.get("letters", {}).get("sounds", {}).get(ch)
        if snd:
            add(f"letter/sound/{ch}", snd, "letters")

    # ---- interface feedback -------------------------------------------------
    for name in vocab.get("ui", []):
        if name in UI_LINES:
            add(f"ui/{name}", UI_LINES[name], "ui")

    # ---- vocabulary ---------------------------------------------------------
    for topic, data in vocab.get("topics", {}).items():

        def word(w: str):
            add(f"word/{w}", w, f"words/{topic}")
            add(f"spell/{w}", spell_join.join(w.lower()), f"spell/{topic}")
            if with_sounds:
                snd = [vocab.get("letters", {}).get("sounds", {}).get(c, c) for c in w.lower()]
                add(f"kspell/{w}", spell_join.join(snd), f"spell/{topic}")

        for w in data.get("cvc", []):
            word(w)
        for w in data.get("blend", []):
            word(w)
        for pair in data.get("tricky", []):          # [near-identical pair]
            for w in pair:
                word(w)
        for w in data.get("long", []):
            word(w)
        for w in data.get("words", []):
            word(w)
        for item in data.get("items", []):
            word(item["word"])
            # A spoken clue ("You write with it.") lets pupils identify an
            # object without seeing it; a spoken location lets them place
            # it. Both fields are optional.
            if item.get("desc"):
                add(f"desc/{item['word']}", item["desc"], f"desc/{topic}")
            if item.get("place"):
                add(f"place/{item['word']}", item["place"], f"place/{topic}")

    return clips


async def render(clips: list[dict], voice: str, rate: str, volume: str, force: bool, jobs: int):
    import edge_tts

    sem = asyncio.Semaphore(jobs)
    done = skipped = failed = 0
    errors: list[tuple[str, str]] = []

    async def one(clip: dict):
        nonlocal done, skipped, failed
        target = AUDIO / clip["file"]
        if target.exists() and target.stat().st_size > 200 and not force:
            skipped += 1
            return
        async with sem:
            for attempt in range(3):
                try:
                    target.parent.mkdir(parents=True, exist_ok=True)
                    comm = edge_tts.Communicate(clip["text"], voice, rate=rate, volume=volume)
                    await comm.save(str(target))
                    done += 1
                    return
                except Exception as exc:                       # noqa: BLE001
                    if attempt == 2:
                        failed += 1
                        errors.append((clip["key"], str(exc)[:90]))
                    else:
                        await asyncio.sleep(1.5 * (attempt + 1))

    await asyncio.gather(*(one(c) for c in clips))
    return done, skipped, failed, errors


def write_outputs(clips: list[dict], vocab: dict) -> int:
    """Manifest for the audio player + a classic-script copy of the vocab."""
    # Paths are written relative to the SITE ROOT, because the page loads
    # the manifest from index.html, not from inside audio/.
    manifest = {c["key"]: "audio/" + c["file"] for c in clips}
    total_bytes = sum(
        (AUDIO / c["file"]).stat().st_size for c in clips if (AUDIO / c["file"]).exists()
    )

    AUDIO.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(
        "/* GENERATED by tools/build_audio.py - do not edit by hand.\n"
        "   Rebuild with:  python tools/build_audio.py */\n"
        "window.LG = window.LG || {};\n"
        "LG.AUDIO_MANIFEST = "
        + json.dumps(manifest, indent=1, ensure_ascii=False, sort_keys=True)
        + ";\n",
        encoding="utf-8",
    )

    BROWSER_DATA.parent.mkdir(parents=True, exist_ok=True)
    BROWSER_DATA.write_text(
        "/* GENERATED from data/vocab.json by tools/build_audio.py — do not edit by hand. */\n"
        "window.LG = window.LG || {};\n"
        "LG.VOCAB = "
        + json.dumps(vocab, indent=1, ensure_ascii=False)
        + ";\n",
        encoding="utf-8",
    )
    return total_bytes


def main() -> int:
    ap = argparse.ArgumentParser(description="Render the Word Quest audio pack.")
    ap.add_argument("--only", help="limit to one topic id (e.g. colors, numbers, classroom)")
    ap.add_argument("--force", action="store_true", help="re-render clips that already exist")
    ap.add_argument("--check", action="store_true", help="list missing clips, render nothing")
    ap.add_argument("--sounds", action="store_true", help="also render phonics-sound spelling")
    ap.add_argument("--voice", help="override the voice from vocab.json")
    ap.add_argument("--rate", help="e.g. -12%%")
    ap.add_argument("--jobs", type=int, default=6, help="parallel requests (default 6)")
    ap.add_argument("--spell-joiner", default=", ", help="separator between spelled letters")
    ap.add_argument("--prune", action="store_true",
                    help="delete rendered mp3s that the manifest no longer references")
    args = ap.parse_args()

    vocab = json.loads(VOCAB.read_text(encoding="utf-8"))
    clips = build_clips(vocab, args.spell_joiner, args.sounds)
    if args.only:
        clips = [c for c in clips if f"/{args.only}" in c["file"] or c["group"].endswith(args.only)]

    missing = [c for c in clips if not (AUDIO / c["file"]).exists()]

    if args.check:
        print(f"{len(clips)} clips total, {len(missing)} missing")
        for c in missing[:40]:
            print("  missing:", c["key"], "->", c["text"])
        if len(missing) > 40:
            print(f"  ... and {len(missing) - 40} more")
        return 1 if missing else 0

    voice = args.voice or vocab.get("settings", {}).get("voice", "en-GB-SoniaNeural")
    rate = args.rate or vocab.get("settings", {}).get("rate", "-12%")
    volume = vocab.get("settings", {}).get("volume", "+0%")

    print(f"voice={voice}  rate={rate}  clips={len(clips)}  missing={len(missing)}")
    done, skipped, failed, errors = asyncio.run(
        render(clips, voice, rate, volume, args.force, args.jobs)
    )
    size = write_outputs(clips, vocab)

    if args.prune:
        keep = {c["file"] for c in clips}
        removed = 0
        for p in AUDIO.rglob("*.mp3"):
            if str(p.relative_to(AUDIO)).replace("\\", "/") not in keep:
                p.unlink()
                removed += 1
        if removed:
            print(f"pruned {removed} orphaned clip(s)")
            size = write_outputs(clips, vocab)

    print(f"rendered={done}  already_had={skipped}  failed={failed}")
    print(f"pack size = {size / 1_048_576:.2f} MB")
    for key, err in errors[:10]:
        print("  FAILED", key, "->", err)

    print(f"wrote {MANIFEST.relative_to(ROOT)}")
    print(f"wrote {BROWSER_DATA.relative_to(ROOT)}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
