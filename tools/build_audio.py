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
AUDIO = ROOT / "audio"            # the primary pack; always where the manifest lives
OUT = AUDIO                       # where this run writes clips (a variant dir when --variant)
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
        # Keys are lowercased to match LG.Q.wordKey() in the game, which
        # lower-cases whatever the topic asks for. Without this, a vocab entry
        # like "Open the window" builds "word/Open the window" while the game
        # requests "word/open the window" and silently falls back to Web Speech.
        key = key.lower()
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
        # Generic list for any topic that just needs words rendered. Lets a
        # new topic pack ship audio without touching this file.
        for w in data.get("clips", []):
            word(w)
        # Structured lists: plurals are [singular, plural, kind]; names and
        # instructions are objects. Render whatever is actually spoken.
        for pair in data.get("pairs", []):
            for form in pair[:2]:
                if isinstance(form, str) and form:
                    word(form)
        for group in ("names", "emails", "zWords", "sWords", "prepositions", "short"):
            for w in data.get(group, []):
                word(w)
        # Grammar sentences. These are stored in their CORRECT form, so the
        # recording is a natural sentence and the key matches exactly what a
        # level asks for. The level chooses which word to blank.
        for group in ("gaps", "pick", "negative", "thereIs", "me", "other"):
            for s in data.get(group, []):
                if isinstance(s, str):
                    word(s)
        # Composed sentences. A level that builds a phrase at run time
        # ("My name is " + name) must still have a recording, so templates
        # are expanded here against a named word list. Without this, a
        # level silently falls back to the browser voice for every phrase
        # it composes.
        for spec in data.get("patterns", []):
            tpl = spec.get("template", "")
            source = spec.get("from", "")
            # `from` is a dotted path, so one topic can borrow another's
            # word list: "from": "spellname.names"
            node: object = vocab
            for part in source.split("."):
                node = node.get(part, {}) if isinstance(node, dict) else []
            pool = node if isinstance(node, list) else []
            for w in pool:
                if not isinstance(w, str):
                    continue
                try:
                    word(tpl.format(w=w))
                except (KeyError, IndexError):
                    continue
        for a in data.get("actions", []):
            if a.get("text"):
                word(a["text"])
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
        target = OUT / clip["file"]
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


# ---------------------------------------------------------------------------
# Kokoro: a local, fully offline neural voice.
#
# Same clip list, same manifest, same game code -- only the bytes differ. That
# is the point of keeping every prompt as a pre-rendered MP3: the engine that
# produced them is an implementation detail the browser never sees.
# ---------------------------------------------------------------------------

# Kokoro voice ids start with a language code: a=American, b=British,
# e=Spanish, f=French, h=Hindi, i=Italian, j=Japanese, p=Portuguese, z=Chinese.
# The pipeline is constructed per language, so the code is read off the voice.
KOKORO_LANG = {
    "a": "a", "b": "b", "e": "e", "f": "f", "h": "h",
    "i": "i", "j": "j", "p": "p", "z": "z",
}

KOKORO_VOICES = {
    "british": ["bf_emma", "bm_george", "bf_isabella", "bm_lewis", "bf_alice", "bm_fable"],
    "american": ["af_heart", "am_michael", "af_bella", "am_fenrir", "af_nicole", "af_sarah"],
}


def encode_mp3(samples, sample_rate: int, bitrate: int = 48) -> bytes:
    """PCM -> MP3, in pure Python (no ffmpeg or lame binary).

    Kokoro 0.9.x yields a torch Tensor while 1.x yields a numpy array, so
    normalise both here rather than at every call site.
    """
    import lameenc
    import numpy as np

    if hasattr(samples, "detach"):                 # torch tensor
        samples = samples.detach().cpu().numpy()
    pcm = np.asarray(samples, dtype=np.float32)
    pcm = np.clip(pcm, -1.0, 1.0)
    pcm = (pcm * 32767.0).astype(np.int16).tobytes()

    enc = lameenc.Encoder()
    enc.set_bit_rate(bitrate)      # 48 kbps mono is plenty for spoken words
    enc.set_in_sample_rate(sample_rate)
    enc.set_channels(1)
    enc.set_quality(2)             # 2 = high quality, near-best speed
    return enc.encode(pcm) + enc.flush()


def render_kokoro(clips: list[dict], voice: str, speed: float, force: bool, bitrate: int):
    import sys
    from pathlib import Path as _P

    from kokoro import KPipeline
    import soundfile as sf

    lang = KOKORO_LANG.get(voice[:1].lower())
    if not lang:
        raise SystemExit(
            f"Cannot infer a language from voice '{voice}'. "
            f"Use one of: " + ", ".join(sum(KOKORO_VOICES.values(), []))
        )

    print(f"  loading Kokoro (lang={lang}, voice={voice}, speed={speed}) ...")
    pipe = KPipeline(lang_code=lang)

    done = skipped = failed = 0
    errors: list[tuple[str, str]] = []
    total = len(clips)

    for n, clip in enumerate(clips, 1):
        target = OUT / clip["file"]
        if target.exists() and target.stat().st_size > 200 and not force:
            skipped += 1
            continue
        try:
            target.parent.mkdir(parents=True, exist_ok=True)
            audio = None
            for _graphemes, _phonemes, samples in pipe(clip["text"], voice=voice, speed=speed):
                if samples is not None and len(samples) > 0:
                    audio = samples           # keep the last non-empty chunk
            if audio is None or len(audio) == 0:
                raise RuntimeError("engine produced no audio")
            # KPipeline does not expose sample_rate on every version, so fall
            # back to Kokoro's native 24 kHz rather than encoding at the wrong
            # rate (which would play back fast and chipmunky).
            rate = (getattr(pipe, "sample_rate", None)
                    or getattr(pipe, "sr", None)
                    or 24000)
            target.write_bytes(encode_mp3(audio, rate, bitrate))
            done += 1
        except Exception as exc:                   # noqa: BLE001
            failed += 1
            if len(errors) < 12:
                errors.append((clip["key"], str(exc)[:110]))
        if n % 25 == 0 or n == total:
            print(f"    {n}/{total}  rendered={done} skipped={skipped} failed={failed}", flush=True)

    return done, skipped, failed, errors


def _durations(clips: list[dict]) -> dict:
    """Clip lengths in seconds, so the game can decide how often to repeat.

    Measured at build time rather than probed in the browser: the page
    should never have to fetch an audio file just to find out how long it
    is. Falls back to an empty map if no decoder is available, in which
    case the game simply repeats everything as before.
    """
    try:
        import soundfile as sf
    except ImportError:
        return {}
    out: dict = {}
    for c in clips:
        p = AUDIO / c["file"]
        if not p.exists():
            continue
        try:
            out[c["key"]] = round(sf.info(str(p)).duration, 3)
        except Exception:                      # noqa: BLE001
            continue
    return out


def _variants(all_clips: list[dict]) -> dict:
    """Discover alternative voices stored under audio/variants/<name>/.

    Adding a third voice is just a new folder -- nothing here needs editing.
    A variant file must sit at the same relative path as the clip it
    replaces (desc/classroom/pencil.mp3), so it inherits the key.
    """
    rel_to_key = {c["file"]: c["key"] for c in all_clips}
    vdir = AUDIO / "variants"
    if not vdir.is_dir():
        return {}
    out: dict = {}
    for name in sorted(p.name for p in vdir.iterdir() if p.is_dir()):
        table: dict = {}
        for f in sorted((vdir / name).rglob("*.mp3")):
            rel = f.relative_to(vdir / name).as_posix()
            key = rel_to_key.get(rel)
            if key:
                table[key] = f"audio/variants/{name}/{rel}"
        if table:
            out[name] = table
    return out


def write_outputs(clips: list[dict], vocab: dict) -> int:
    """Manifest for the audio player + a classic-script copy of the vocab."""
    # Paths are written relative to the SITE ROOT, because the page loads
    # the manifest from index.html, not from inside audio/.
    manifest = {c["key"]: "audio/" + c["file"] for c in clips}
    total_bytes = sum(
        (AUDIO / c["file"]).stat().st_size for c in clips if (AUDIO / c["file"]).exists()
    )
    durations = _durations(clips)
    variants = _variants(clips)

    AUDIO.mkdir(parents=True, exist_ok=True)
    body = [
        "/* GENERATED by tools/build_audio.py - do not edit by hand.\n",
        "   Rebuild with:  python tools/build_audio.py\n",
        "   Also exports LG.AUDIO_DURATIONS: clip lengths in seconds, used by\n",
        "   the game to avoid repeating a long sentence three times. */\n",
        "window.LG = window.LG || {};\n",
        "LG.AUDIO_MANIFEST = ",
        json.dumps(manifest, indent=1, ensure_ascii=False, sort_keys=True),
        ";\n",
        "LG.AUDIO_DURATIONS = ",
        json.dumps(durations, indent=1, sort_keys=True),
        ";\n",
        # Named alternative voices, discovered from audio/variants/<name>/.
        # The game picks one from a key here and falls back to the primary
        # manifest for anything a variant does not cover.
        "LG.AUDIO_VARIANTS = ",
        json.dumps(variants, indent=1, sort_keys=True),
        ";\n",
    ]
    MANIFEST.write_text("".join(body), encoding="utf-8")

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
    ap.add_argument("--voice", help="override the edge-tts voice from vocab.json")
    ap.add_argument("--engine", choices=["edge", "kokoro"], default="edge",
                    help="edge = Microsoft's online voice (default); "
                         "kokoro = local offline neural voice")
    ap.add_argument("--kokoro-voice", default="bf_emma",
                    help="Kokoro voice id, e.g. bf_emma or bm_george (British), "
                         "af_heart or am_michael (American)")
    ap.add_argument("--speed", type=float, default=0.95,
                    help="Kokoro speaking speed; 1.0 is normal, lower is slower")
    ap.add_argument("--bitrate", type=int, default=48, help="MP3 kbps for Kokoro output")
    ap.add_argument("--variant", metavar="NAME",
                    help="render into audio/variants/NAME/ instead of replacing the "
                         "primary clips, creating a switchable alternative voice. "
                         "The main manifest still describes the primary pack.")
    ap.add_argument("--rate", help="e.g. -12%%")
    ap.add_argument("--jobs", type=int, default=6, help="parallel requests (default 6)")
    ap.add_argument("--spell-joiner", default=", ", help="separator between spelled letters")
    ap.add_argument("--prune", action="store_true",
                    help="delete rendered mp3s that the manifest no longer references")
    args = ap.parse_args()

    vocab = json.loads(VOCAB.read_text(encoding="utf-8"))
    clips = build_clips(vocab, args.spell_joiner, args.sounds)
    # The manifest must always describe the WHOLE pack. `--only` narrows
    # which clips get rendered, never which clips the game may ask for --
    # otherwise a partial run would silently delete the other entries and
    # the game would quietly fall back to Web Speech for everything else.
    all_clips = build_clips(vocab, args.spell_joiner, args.sounds)

    global OUT
    if args.variant:
        name = re.sub(r"[^a-z0-9_.-]+", "", args.variant.lower())
        if not name:
            raise SystemExit("--variant needs a name made of letters, digits, - _ or .")
        OUT = AUDIO / "variants" / name
        OUT.mkdir(parents=True, exist_ok=True)
        print(f"variant: writing into {OUT.relative_to(ROOT)}/ (primary pack untouched)")

    if args.only:
        # Groups are shaped like "words/colors" or "letters", so match the
        # whole group, its first segment ("desc", "place", "words") or the
        # topic segment ("colors"). This is what makes the two-voice
        # workflow possible: render the clue clips with a different voice.
        want = args.only.lower()

        def matches(clip: dict) -> bool:
            parts = clip["group"].split("/")
            return (
                clip["group"] == want
                or parts[0] == want
                or (len(parts) > 1 and parts[1] == want)
            )

        clips = [c for c in all_clips if matches(c)]
        if not clips:
            raise SystemExit(f"--only {args.only!r} matched no clips. Groups are: "
                             + ", ".join(sorted({c['group'] for c in all_clips})))

    missing = [c for c in clips if not (OUT / c["file"]).exists()]

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

    if args.engine == "kokoro":
        print(f"engine=kokoro  voice={args.kokoro_voice}  speed={args.speed}  "
              f"clips={len(clips)}  missing={len(missing)}")
        done, skipped, failed, errors = render_kokoro(
            clips, args.kokoro_voice, args.speed, args.force, args.bitrate
        )
    else:
        print(f"engine=edge-tts  voice={voice}  rate={rate}  clips={len(clips)}  missing={len(missing)}")
        done, skipped, failed, errors = asyncio.run(
            render(clips, voice, rate, volume, args.force, args.jobs)
        )
    # Always the full pack, never the --only subset.
    size = write_outputs(all_clips, vocab)

    if args.prune and not args.variant:
        # Prune against the full manifest, so a partial run cannot delete the
        # other 349 clips as "orphans". Variant clips are addressed relative
        # to their own folder, so they are kept by path prefix -- comparing
        # them against the primary list would delete every alternative voice.
        keep = {c["file"] for c in all_clips}
        removed = 0
        for p in AUDIO.rglob("*.mp3"):
            rel = p.relative_to(AUDIO).as_posix()
            parts = rel.split("/")
            if parts[0] == "variants":
                continue                      # alternative voices are never pruned
            if rel not in keep:
                p.unlink()
                removed += 1
        if removed:
            print(f"pruned {removed} orphaned clip(s)")
            size = write_outputs(all_clips, vocab)

    print(f"rendered={done}  already_had={skipped}  failed={failed}")
    print(f"pack size = {size / 1_048_576:.2f} MB")
    for key, err in errors[:10]:
        print("  FAILED", key, "->", err)

    print(f"wrote {MANIFEST.relative_to(ROOT)}")
    print(f"wrote {BROWSER_DATA.relative_to(ROOT)}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
