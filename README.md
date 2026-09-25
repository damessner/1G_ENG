# Word Quest

English practice games for young learners. Every prompt is spoken, so pupils
who cannot yet read the instructions can still play. All audio is
pre-recorded MP3, so it sounds identical on every device and works with no
internet connection.

Built for ages 10-11, one device per pupil. Progress is stored per device.

---

## Play it

Double-click `index.html`. That's it — no server, no install, no internet.

It is plain HTML/CSS/JS with no build step and no dependencies. If you serve it
over HTTP instead, that works too:

```
python -m http.server 8777
```

While you are editing, use the bundled dev server instead. `http.server` sends
no `Cache-Control` at all, so the browser invents a freshness lifetime and
serves you a stale copy of a file you just changed — which looks exactly like
a code bug:

```
python tools\serve.py            # adds Cache-Control: no-store
```

If a file still looks stale after that, try a different port (`serve.py 8778`).
Ports are separate origins with separate caches, which is the quickest way to
rule caching out when something impossible is on screen.

---

## Structure: units, topics, levels

```
Unit 1  (js/units/unit1/)          <- a syllabus unit, a folder
  Alphabet    7 levels              <- a topic, a folder
    levels.js   the curriculum for that topic
    index.js    its name, icon, colour
  Numbers     8
  Colors      6
  Classroom   5
  Plurals     5
  Names       5
  The /z/ Sound  4
  Instructions  4
```

Nothing above the topic layer knows what "Unit 1" means — a unit is just a
name, a number and an ordering, which is why Unit 2 is a copy of Unit 1 rather
than a refactor. The home screen mirrors the syllabus, showing each unit as a
section.

| Topic | Levels | What they practise |
|---|---|---|
| Alphabet | 7 | letter names, first sound, missing letter, spelling, tricky pairs (b/d, p/q), blends (sh, ch, th), longer words |
| Numbers | 8 | counting to 10, 20 and 25, counting on, taking away, comparing, missing numbers, hearing 11-25 |
| Colors | 6 | hear→tap, read→tap, mixed, colour trap, colour→word, odd one out |
| Classroom | 5 | listen→find, read→find, spoken clues, lookalikes, where things go |
| Plurals | 5 | one or many, irregular plurals (child/children, mouse/mice), reading plurals, odd one out |
| Names | 5 | spelling names, spelling with no help, telling two names apart, email addresses |
| The /z/ Sound | 4 | z and zz discrimination, buzz vs hiss, two z-words or two s-words, spelling a /z/ word |
| Instructions | 4 | which instruction did you hear (minimal pairs), read it and do it, which picture, what did they ask |

Each level is 5-12 questions. Three stars need 90% correct. No lives, no
punishment for mistakes — wrong answers are explained and the round continues,
because being stuck should never cost a child their confidence.

Each level is 8-12 questions. Three stars need 90% correct. No lives, no
punishment for mistakes — wrong answers are explained and the round continues,
because being stuck should never cost a child their streak of confidence.

Progress per pupil: XP, rank (Newcomer → Lexicon Legend), 9 badges, daily
streak, and stars per level.

---

## Audio behaviour

Every prompt is heard **three times** with a gap, and there is a small 🔊
button in the top right to hear it again on demand. Both are deliberate: a
pupil who has not caught a word should be able to re-hear it without penalty
and without a visible "I am stuck" signal.

| Setting | Default | Where |
|---|---|---|
| Times each prompt repeats | 3 | Settings → *Play each question* (once / twice / three times) |
| Long spoken clues | 1 | Settings → *Long spoken clues* |
| Number keys answer | off | Settings → *Number keys answer* |
| Voice | main | Settings → *Voice*, or the 👤 button in-game |
| Gap between repeats | ~0.7 s | `TIMING.repeatGapMs` in `js/core/engine.js` |
| Silence after "Well done!" | 2.0 s | `TIMING.afterCorrectMs` |
| Silence after a mistake | 2.3 s | `TIMING.afterWrongMs` |

**Words repeat three times; sentences do not.** The classroom clues ("It keeps
your pencils safe.") are whole sentences, about 2.7 s against 1.9 s for a word.
Hearing "pencil" three times is practice; hearing a full sentence three times is
just waiting, so clue levels play once and rely on the re-hear button.

That is a teaching decision, so it is declared on the level
(`longPrompt: true` in `js/units/unit1/classroom/levels.js`) rather than inferred.
Clip lengths are measured at build time and published as `LG.AUDIO_DURATIONS`,
and are used only as a fallback for a level added later without the flag — not
for the spelling levels, where a word plus its letter-by-letter spelling is two
clips and repetition is exactly the point.

Number-key answering is **off by default**. It is handy when the site is on a
projector and a teacher calls answers out, but on a pupil's own laptop a
stray brush of the number row would answer the question for them — the most
confusing thing this game could do. Turn it on only for whole-class use.

### Comparing voices

`audio-preview/` holds the same clips rendered with an alternative voice, kept
out of the deployed site and out of the manifest. To A/B two voices for the
clues, render the second one there and open the files in any audio player:

```
audio/desc/classroom/pencil.mp3            <- the voice currently in the game
audio-preview/desc/classroom/pencil.mp3    <- the alternative
```

Render a different voice into it with:

```powershell
python tools\build_audio.py --engine kokoro --only desc --kokoro-voice bf_emma
```

Keep the comparison British (`b_` voices). The `a_` voices are American, and
an American "colour" teaches the wrong thing.

The pause after feedback **chains off the audio's own end event** rather than a
fixed timer, so the next question can never start on top of the praise. An
8-second safety timeout backstops a missing clip so a round can never freeze.

The 🔊 button plays a single re-hear; the large **Listen** button replays the
full set of repeats. On reading-only levels (the number sequences, "Read and
Tap") there is nothing to hear, so both are hidden.

---

## Layout

```
index.html              the whole app shell; also the manifest of what loads
css/style.css           design system, 64px minimum touch targets
data/vocab.json         ← EDIT THIS to change words. Single source of truth.
js/
  data/vocab.js         generated from vocab.json — do not edit
  core/
    storage.js          namespaced localStorage with a safe fallback
    speech.js           Web Speech FALLBACK (only used if a clip is missing)
    audio.js            the real player: manifest lookup + graceful degradation
    gamification.js     XP, ranks, stars, badges
    questions.js        the authoring API (LG.Q) topic files are written against
    engine.js           runs a level: audio, scoring, feedback, progress
    ui.js               DOM helpers, modals, confetti
  modes/                three generic game modes, topic-agnostic
    choice.js           pick one of N options
    assemble.js         build a word from letter tiles
    quantity.js         tap the right number of objects
  topics/<id>/
    levels.js           the curriculum for one topic
    index.js            its name, icon, colour
tools/
  build_audio.py        renders data/vocab.json to MP3 + writes the manifest
  validate.py           catches broken vocabulary before it reaches a classroom
audio/                  generated MP3 pack + manifest.js
```

**The key idea:** the three game modes know nothing about any subject, and the
topic packs contain no UI code. A topic is just a list of levels that know how
to build questions. That is why adding a fifth topic touches no engine code.

---

## Adding or changing words

1. Edit `data/vocab.json`.
2. Run the build (see below).
3. Reload the page.

The browser never reads the JSON directly — it reads `js/data/vocab.js`, which
the build regenerates from the same file, so the two can never drift apart.

### Regenerating audio

```
python -m venv .venv                       # first time only
.venv\Scripts\python -m pip install edge-tts
.venv\Scripts\python tools\build_audio.py
```

Useful flags:

| Command | Effect |
|---|---|
| `build_audio.py` | render only what's missing (fast, safe to re-run) |
| `build_audio.py --check` | list gaps, render nothing |
| `build_audio.py --only colors` | one topic |
| `build_audio.py --force` | re-render everything, e.g. after changing voice |
| `build_audio.py --prune` | also delete clips nothing references |
| `build_audio.py --voice en-GB-RyanNeural` | a different voice |
| `build_audio.py --rate -5%` | change speaking speed |

### Choosing a voice

Two engines are available. Both produce the same clip list, the same
manifest, and the same game code — only the bytes behind each clip differ,
which is the whole point of pre-recording.

| Engine | Internet | Quality | Setup |
|---|---|---|---|
| `edge` (default) | needed to render | Excellent | small |
| `kokoro` | **fully offline** | Excellent, more natural | ~1 GB, first run downloads a model |

```
# Microsoft's voice (default)
python tools\build_audio.py

# Kokoro, local and offline
python tools\build_audio.py --engine kokoro --kokoro-voice bf_emma --force
```

Kokoro voice ids begin with a language code (`b`=British, `a`=American) and
the pipeline is built per language from that code:

- British: `bf_emma`, `bm_george`, `bf_isabella`, `bm_lewis`
- American: `af_heart`, `am_michael`, `af_bella`

Other flags: `--speed` (1.0 normal, lower is slower), `--bitrate` (48 kbps
mono suits spoken words), `--force` to re-render.

Kokoro emits 24 kHz WAV, so it is encoded to MP3 with `lameenc` — pure
Python, no ffmpeg or lame binary needed.

#### Two voices, switchable at runtime

Alternative voices live in `audio/variants/<name>/`, at the same relative path
as the clip they replace. The build discovers them automatically, so a third
voice is just a new folder — nothing to configure.

```
audio/desc/classroom/pencil.mp3                 ← main voice
audio/variants/emma/desc/classroom/pencil.mp3   ← alternative
```

Create one with `--variant`, which writes into that folder and leaves the main
pack untouched:

```powershell
python tools\build_audio.py --engine kokoro --only desc --variant emma --kokoro-voice bf_emma
```

A variant only has to record the clips it actually replaces. Anything it
doesn't cover falls through to the main voice, so recording only the 24 clue
sentences is enough.

**Switching.** A small 👤 button appears in the game header, but *only* on
questions that have an alternative recording — on the clue levels, nowhere
else. Tapping it switches voice and immediately re-hears, so the change is
audible at once. The choice is remembered. Settings → *Voice* picks one
directly, with the clip count shown.

Which voice is a teaching decision: on the "What Is It?" and "Real or Fake?"
levels the prompt is a spoken *clue* ("You write with it."), so a different
speaker turns an abstract question into a character talking. Worth A/B-ing
with a few pupils before settling.

Keep comparisons British (`b_` voices). The `a_` voices are American, and an
American "colour" teaches the wrong thing.

### Checking the pack

```
python tools\validate.py
```

Standard library only, so it runs in CI too — and the deploy workflow will
**refuse to publish** if it fails. It catches the mistakes that quietly ruin a
game: two objects drawn with the same emoji, a "real or fake" lookalike
identical to the answer, a colour word with no swatch, and a manifest
referencing clips that do not exist.

### Clip naming

The generator produces these keys, and the game asks for them by name:

| Key | Content |
|---|---|
| `word/<text>` | the word, spoken normally |
| `spell/<text>` | the word spelled aloud, letter by letter |
| `letter/name/<ch>` | a letter's name |
| `letter/sound/<ch>` | a letter's phonics sound |
| `desc/<text>` | a spoken clue for the classroom objects |
| `place/<text>` | a spoken location |
| `ui/<name>` | "Yes! Well done!", "Try again", etc. |

If a key is missing, the game silently falls back to the browser's own speech
engine. It never goes quiet.

---

## Adding a whole new topic

Say you want animals. Create `js/units/unit1/animals/levels.js`:

```js
(function () {
  'use strict';
  var Q = LG.Q;
  var ANIMALS = LG.VOCAB.topics.animals.items;   // add this to data/vocab.json too

  LG.topicData('animals', [
    {
      id: 'an1', name: 'Listen and Find', mode: 'choice',
      difficulty: 1, count: 10,
      blurb: 'Hear the animal. Tap its picture.',
      build: function () {
        var a = Q.pick(ANIMALS);
        return Q.choice({
          prompt: Q.audio(Q.wordKey(a.word)),
          options: Q.emojis(a.emoji, Q.sample(ANIMALS, 3).map(function (x) {
            return x.emoji;
          })),
          answer: a.emoji,
          dedupe: 'lf' + a.word
        });
      }
    }
  ]);
})();
```

And `js/units/unit1/animals/index.js`:

```js
LG.registerTopic({
  id: 'animals',
  unit: 'unit1',
  name: 'Animals',
  tagline: 'Pets and wild animals',
  icon: '\uD83D\uDC2E',
  color: '#84cc16',
  soft: '#f7fee7',
  levels: LG._pending.animals || []
});
```

Then add two `<script>` tags to `index.html`. **The order of those tags is the
order of the cards inside the unit.**

Always give a level a `dedupe` key. The engine uses it to avoid asking the
same thing twice in one round; without it, repeat avoidance falls back to
comparing whole questions and only works by accident. `validate.py` will tell
you if a level's word pool is too small to fill a round without repeats.

### Adding a whole new unit

```
js/units/unit2/index.js
js/units/unit2/<topic>/levels.js  +  index.js
```

`index.js` is six lines — an id, a number, a name, a tagline and a colour:

```js
LG.Units.register({
  id: 'unit2', number: 2, name: 'Unit 2',
  tagline: '...', icon: '\uD83C\uDFAF', accent: '#0ea5e9'
});
```

Then copy the Unit 1 block in `index.html` and change the paths. Nothing else
in the codebase needs to know the unit exists.

That's the whole process. The engine, the audio player and the scoring need no
changes.

### Writing a new game mode

If a level needs a genuinely new interaction, add `js/modes/mymode.js`:

```js
LG.Modes.mymode = {
  id: 'mymode',
  render: function (container, question, api) {
    // build the UI here. Call api.submit(true/false) when answered.
    // Return an optional { destroy, hint, reveal }.
  }
};
```

`api` gives you `submit(ok)`, `lock()`, and `isLocked()`.

---

## Deploying to GitHub Pages

The app is static: `index.html`, `css/`, `js/`, `audio/`. No build step, no
server, no secrets. GitHub's own Actions runner publishes it using an
automatic token that GitHub issues per run and throws away afterwards, so there
is no access token for you to create or protect.

The audio pack is 5.1 MB, well inside Pages' 1 GB limit.

**Before your first commit**, check that `data/vocab.json`, `js/data/vocab.js`
and `audio/manifest.js` are all present and up to date. They are generated
files, but they *must* be committed — the deployed site is the repository, not
your build step. `.venv/` is gitignored and must stay that way.

See `DEPLOY.md` for the step-by-step.

---

## Design notes

- **Audio-first.** Every instruction is spoken. A pupil who cannot decode
  "tap the letter it starts with" can still play the game.
- **No punishment.** No lives, no timer, no locked levels. Hints cost some XP
  and nothing else. A wrong answer shows the right one and moves on.
- **Listen is unlimited and never hidden.** Being stuck should be free.
- **Counting does not auto-submit.** If the quantity mode submitted the moment
  the count matched, a child could tap blindly until the number was right and
  never count at all. The explicit Check button is what makes it a counting
  task.
- **Reading and listening are separate levels.** Colour words are taught
  hear→colour and read→colour separately before being mixed, because conflating
  them is what produces a child who recognises the colour but not the word.
- **Fallback audio.** If a clip is missing, or the pack failed to build, the
  browser's own speech engine covers it. The game degrades instead of breaking.
