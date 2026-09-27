#!/usr/bin/env python
"""
import_vocab.py -- import vocabulary/*.md into data/vocab.json.

The markdown files are the source of truth. This merges them into the
JSON the game reads, and never touches anything a human has written by
hand (emoji, descriptions, levels, settings).

    python tools\\import_vocab.py            # merge, print a report
    python tools\\import_vocab.py --dry-run  # report only, change nothing

Idempotent: run it as often as you like. It replaces the imported topics
rather than appending to them, so deleting a word from the markdown
removes it from the game on the next run.

Column layouts differ between files -- the Opposites table has three
columns, the MORE tables have four -- so columns are matched by their
header name rather than by position.
"""
from __future__ import annotations

import argparse
import collections
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
VOCAB_DIR = ROOT / "vocabulary"
VOCAB_JSON = ROOT / "data" / "vocab.json"

HEADING = re.compile(r"^(#{1,4})\s+(.*)$")
TABLE_ROW = re.compile(r"^\s*\|(.+)\|\s*$")
TABLE_SEP = re.compile(r"^\s*\|[\s:|-]+\|\s*$")
BOLD = re.compile(r"\*\*(.+?)\*\*")
ITALIC = re.compile(r"\*(.+?)\*")

# A key prefix for imported topics, so they can never collide with the
# hand-written ones (alphabet, numbers, tobe, ...).
IMPORT_PREFIX = "u"


def clean(text: str) -> str:
    text = BOLD.sub(r"\1", text)
    text = ITALIC.sub(r"\1", text)
    text = text.replace("<br>", " ").replace("&nbsp;", " ")
    text = re.sub(r"\(.*?\)", "", text)          # drop glosses like (there's)
    text = text.replace("**", "").replace("*", "")
    return re.sub(r"\s+", " ", text).strip(" |")


def slug(text: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return s or "x"


# Multi-word items that are still single vocabulary entries rather than
# phrases. Without this, "in front of" is filed as a phrase because it has
# three words, and it would be treated as functional language rather than
# as the preposition the unit is actually teaching.
PREPOSITION_STARTS = (
    "in front", "next to", "in ", "on ", "at ", "under ", "behind ",
    "between ", "over ", "near ", "up ", "out ", "to ", "for ",
)


def kind_of(english: str) -> tuple[str, str]:
    """Return (display form, kind) for a vocabulary row.

    Verbs keep their 'to' because that is how they are taught and looked
    up; phrases stay whole; everything else is a plain word.
    """
    low = english.lower()
    if low.startswith("to "):
        return english, "verb"
    if low.startswith(PREPOSITION_STARTS) and len(english.split()) <= 3:
        return english, "word"
    if len(english.split()) >= 3:
        return english, "phrase"
    return english, "word"


def parse_file(path: pathlib.Path) -> dict:
    """Return {'sections': [...], 'more': [...]} for one markdown file."""
    lines = path.read_text(encoding="utf-8").splitlines()
    sections: list[dict] = []
    more: list[dict] = []
    heading = None
    rows: list[list[str]] = []
    header: list[str] = []

    def flush():
        nonlocal rows, header
        if not rows or not header:
            rows, header = [], []
            return
        idx = {clean(h).lower(): i for i, h in enumerate(header)}

        def col(*names):
            for n in names:
                if n in idx:
                    return idx[n]
            return None

        i_en = col("english")
        i_de = col("german")
        i_ex = col("example sentence", "beispielsatz")
        i_op = col("opposite", "gegenteil")
        i_mk = col("unit / marker", "marker", "unit")

        out = []
        for r in rows:
            def val(i):
                return clean(r[i]) if i is not None and i < len(r) else ""

            en = val(i_en)
            if not en:
                continue
            display, kind = kind_of(en)
            item = {"word": display, "kind": kind}
            de = val(i_de)
            if de:
                item["de"] = de
            ex = val(i_ex)
            if ex:
                item["ex"] = ex
            op = val(i_op)
            if op:
                item["opposite"] = op
            mk = val(i_mk)
            if mk:
                item["marker"] = mk
            out.append(item)
        if out:
            (more if "more words" in (heading or "").lower() else sections).append({
                "name": heading, "items": out
            })
        rows, header = [], []

    for line in lines:
        m = HEADING.match(line)
        if m:
            flush()
            heading = m.group(2).strip()
            continue
        if not TABLE_ROW.match(line):
            continue
        if TABLE_SEP.match(line):
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if not any(cells):
            continue
        if not header and cells and clean(cells[0]).lower() in (
                "english", "unit / marker", "unit/marker"):
            header = cells
            continue
        if header:
            rows.append(cells)
    flush()
    return {"sections": sections, "more": more}


def unit_from_name(path: pathlib.Path) -> str:
    m = re.search(r"(\d+)", path.stem)
    return "unit" + m.group(1) if m else path.stem.lower()


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    if not VOCAB_DIR.is_dir():
        print("no vocabulary/ folder -- nothing to import", file=sys.stderr)
        return 1

    files = sorted(VOCAB_DIR.glob("*.md"))
    if not files:
        print("no .md files in vocabulary/", file=sys.stderr)
        return 1

    data = json.loads(VOCAB_JSON.read_text(encoding="utf-8"),
                      object_pairs_hook=collections.OrderedDict)
    topics = data.setdefault("topics", collections.OrderedDict())

    imported: dict = {}
    warnings: list[str] = []
    report: list[tuple] = []

    for path in files:
        parsed = parse_file(path)
        unit = unit_from_name(path)

        for sec in parsed["sections"]:
            key = f"{IMPORT_PREFIX}{unit[-1]}_{slug(sec['name'])}"
            items = sec["items"]
            existing = topics.get(key, {})
            entry = collections.OrderedDict()
            entry["_source"] = f"vocabulary/{path.name} / {sec['name']}"
            entry["_unit"] = unit
            entry["words"] = items
            # preserve any hand-written extras already in this topic
            for k in ("desc", "note", "emoji"):
                if k in existing:
                    entry[k] = existing[k]
            imported[key] = entry
            report.append((path.name, sec["name"], key, len(items)))

        for sec in parsed["more"]:
            key = f"{IMPORT_PREFIX}{unit[-1]}_more"
            bucket = imported.setdefault(key, collections.OrderedDict([
                ("_source", f"vocabulary/{path.name}"),
                ("_unit", unit),
                ("words", []),
                ("phrases", []),
            ]))
            for item in sec["items"]:
                # verbs and plain words share the 'words' bucket; a verb is
                # still a vocabulary item, it just keeps its "to"
                bucket["phrases" if item["kind"] == "phrase" else "words"].append(item)
            report.append((path.name, "MORE: " + sec["name"], key, len(sec["items"])))

    # sanity checks
    for key, entry in imported.items():
        for group in ("words", "phrases"):
            seen = set()
            for item in entry.get(group, []):
                low = item["word"].lower()
                if low in seen:
                    warnings.append(f"{key}: '{item['word']}' appears twice")
                seen.add(low)
                if len(item["word"]) < 2:
                    warnings.append(f"{key}: suspiciously short entry '{item['word']}'")

    print("Imported topics\n" + "-" * 66)
    for fname, sec, key, n in report:
        print("  %-24s %-26s %-22s %d" % (fname, sec[:26], key, n))
    print("-" * 66)

    total_words = sum(len(e.get("words", [])) for e in imported.values())
    total_phrases = sum(len(e.get("phrases", [])) for e in imported.values())
    de = sum(1 for e in imported.values()
             for g in ("words", "phrases") for it in e.get(g, []) if it.get("de"))
    ex = sum(1 for e in imported.values()
             for g in ("words", "phrases") for it in e.get(g, []) if it.get("ex"))
    print("words: %d   phrases: %d   with German: %d   with example: %d"
          % (total_words, total_phrases, de, ex))

    for w in warnings:
        print("  warning:", w)

    if args.dry_run:
        print("\ndry run -- nothing written")
        return 0

    topics.update(imported)
    data["imported"] = {
        "source": "vocabulary/*.md",
        "files": [p.name for p in files],
        "topics": sorted(imported.keys()),
    }
    VOCAB_JSON.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("\nwrote %s" % VOCAB_JSON.relative_to(ROOT))
    print("next: python tools\\build_audio.py")
    return 0


if __name__ == "__main__":
    sys.exit(main())
