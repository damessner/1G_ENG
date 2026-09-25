# Word Quest

English practice games for young learners: **alphabet & spelling, numbers,
colours, classroom objects**. Every prompt is spoken, so pupils who cannot yet
read the instructions can still play. All audio is pre-recorded MP3, so it
sounds identical on every device and works with no internet connection.

Built for ages 10-11, one device per pupil. Progress is stored per device.

---

## Play it

Double-click `index.html`. That's it — no server, no install, no internet.

It is plain HTML/CSS/JS with no build step and no dependencies. If you serve it
over HTTP instead, that works too:

```
python -m http.server 8777
```

---

## What's in it

| Topic | Levels | What they practise |
|---|---|---|
| Alphabet | 7 | letter names, first sound, missing letter, spelling, tricky pairs (b/d, p/q), blends (sh, ch, th), longer words |
| Numbers | 6 | counting to 10 and 20, counting on, taking away, comparing, missing numbers |
| Colors | 6 | hear→tap, read→tap, mixed, colour trap, colour→word, odd one out |
| Classroom | 5 | listen→find, read→find, spoken clues, lookalikes, where things go |

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
| Number keys answer | off | Settings → *Number keys answer* |
| Gap between repeats | ~1.9 s | `TIMING.repeatGapMs` in `js/core/engine.js` |
| Silence after "Well done!" | 2.0 s | `TIMING.afterCorrectMs` |
| Silence after a mistake | 2.3 s | `TIMING.afterWrongMs` |

Number-key answering is **off by default**. It is handy when the site is on a
projector and a teacher calls answers out, but on a pupil's own laptop a
stray brush of the number row would answer the question for them — the most
confusing thing this game could do. Turn it on only for whole-class use.

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

Then check the vocabulary is sound:

```
.venv\Scripts\python tools\validate.py
```

`validate.py` catches the mistakes that quietly ruin a game: two objects drawn
with the same emoji, a "real or fake" lookalike identical to the answer, a
colour word with no swatch, a word with no audio clip.

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

Say you want animals. Create `js/topics/animals/levels.js`:

```js
(function () {
  'use strict';
  var Q = LG.Q;
  var V = LG.VOCAB.topics.animals;      // add this array to data/vocab.json too
  var ANIMALS = V.words;

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
          answer: a.emoji
        });
      }
    }
  ]);
})();
```

And `js/topics/animals/index.js`:

```js
LG.registerTopic({
  id: 'animals',
  name: 'Animals',
  tagline: 'Pets and wild animals',
  icon: '\uD83D\uDC2E',
  color: '#84cc16',
  soft: '#f7fee7',
  levels: LG._pending.animals || []
});
```

Then add two `<script>` tags to `index.html` after the other topics. **The order
of those tags is the order of the cards on the home screen.**

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
