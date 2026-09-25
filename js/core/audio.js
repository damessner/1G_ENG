/* =============================================================
   audio.js — the primary sound layer.

   Every prompt in the game goes through say(). It resolves a logical
   key such as "word/cat", "spell/cat" or "letter/name/b" against the
   generated manifest and plays a pre-rendered MP3. If that clip is
   missing it degrades to Web Speech so the game never goes silent.

   Keys, by convention (see tools/build_audio.py):
     word/<text>         the word, spoken normally
     spell/<text>        the word spelled out, letter by letter
     kspell/<text>       spelled out using phonics sounds
     letter/name/<ch>    the letter's name
     letter/sound/<ch>   the letter's phonics sound
     ui/<name>           interface feedback
   ============================================================= */
window.LG = window.LG || {};

LG.Audio = (function () {
  'use strict';

  var manifest = {};
  var pool = [];        // recycled <audio> elements
  var POOL_MAX = 6;
  var current = null;
  var muted = false;
  var prefetched = {};
  var variant = 'default';

  function key(text) {
    return String(text).trim().toLowerCase();
  }

  function has(k) {
    return Object.prototype.hasOwnProperty.call(manifest, k);
  }

  /* Alternative voices live in LG.AUDIO_VARIANTS, keyed by variant name and
     then by clip key. A variant only has to cover the clips it actually
     replaces -- anything it misses falls through to the primary pack, so a
     variant holding just the 24 clue sentences is enough. */
  function variantTable() {
    return (window.LG.AUDIO_VARIANTS || {})[variant] || null;
  }

  function hasVariant(k) {
    var t = variantTable();
    return !!(t && t[k]);
  }

  /* "Does any alternative voice have this clip?" -- used to decide whether
     to offer the switch button at all. Checking only the *selected* variant
     would hide the button precisely when it is needed, since switching is
     the act of moving to a different one. */
  function anyVariantHas(k) {
    var all = window.LG.AUDIO_VARIANTS || {};
    for (var name in all) {
      if (Object.prototype.hasOwnProperty.call(all, name) && all[name] && all[name][k]) {
        return true;
      }
    }
    return false;
  }

  function listVariants() {
    return Object.keys(window.LG.AUDIO_VARIANTS || {}).sort();
  }

  function srcFor(k) {
    var t = variantTable();
    if (t && t[k]) return t[k];
    return manifest[k] || null;
  }

  function grab() {
    var el = pool.pop();
    if (el) { el.pause(); el.currentTime = 0; return el; }
    var a = document.createElement('audio');
    a.preload = 'auto';
    a.setAttribute('playsinline', '');
    return a;
  }

  function release(el) {
    if (pool.length < POOL_MAX) pool.push(el);
  }

  /* Play one rendered clip. Resolves true when a real MP3 was used. */
  function playClip(k) {
    var src = srcFor(k);
    if (!src) return Promise.resolve(false);
    return new Promise(function (resolve) {
      var el = grab();
      el.src = src;
      var settled = false;
      function finish(used) {
        if (settled) return;
        settled = true;
        clearTimeout(guard);
        release(el);
        resolve(used);
      }
      // Never let a missing/corrupt file stall the round.
      var guard = setTimeout(function () { finish(false); }, 4000);
      el.onended = function () { finish(true); };
      el.onerror = function () { finish(false); };
      try {
        var p = el.play();
        if (p && p.catch) p.catch(function () { finish(false); });
      } catch (e) { finish(false); }
    });
  }

  function stop() {
    if (current) { current.pause(); current.onended = null; current = null; }
    LG.Speech.stop();
  }

  /* Warm the cache for the words a level is about to ask about. */
  function prefetch(keys) {
    (keys || []).forEach(function (k) {
      if (prefetched[k]) return;
      var a = new Audio();
      a.preload = 'auto';
      a.src = manifest[k] || '';
      prefetched[k] = true;
    });
  }

  /**
   * say(keyOrText) — the one call the game makes.
   * Falls back to speaking the text, and for a key like word/cat it
   * knows the underlying text is "cat".
   */
  function say(k, opts) {
    if (muted) return Promise.resolve(true);
    opts = opts || {};
    stop();
    return playClip(k).then(function (used) {
      if (used) return true;
      var fallbackText = textFor(k);
      if (fallbackText) return LG.Speech.say(fallbackText, opts).then(function () { return false; });
      return false;
    });
  }

  /* Reconstruct speakable text from a key, so fallback always works. */
  function textFor(k) {
    if (!k) return '';
    if (k.indexOf('word/') === 0) return k.slice(5);
    if (k.indexOf('ui/') === 0) {
      var lines = {
        correct: 'Yes! Well done!', wrong: 'Try again',
        levelComplete: 'Level complete!', levelUp: 'New level unlocked!',
        badge: 'New badge!', listenAgain: 'Listen again',
        tapToHear: 'Tap to hear', youScored: 'You scored', tryAgain: 'Try again'
      };
      return lines[k.slice(3)] || '';
    }
    if (k.indexOf('letter/name/') === 0) return k.slice(12);
    if (k.indexOf('letter/sound/') === 0) return LG.Speech.letterSound(k.slice(13));
    if (k.indexOf('spell/') === 0 || k.indexOf('kspell/') === 0) {
      return k.split('/')[1].toLowerCase().split('').join(', ');
    }
    return '';
  }

  /**
   * playSequence(keys, onItem) — speak several clips in order, invoking
   * onItem(item, index) as each one starts. Used to reveal letters one at
   * a time while they are being spoken aloud.
   */
  function playSequence(keys, onItem) {
    stop();
    var list = (keys || []).filter(Boolean);
    if (!list.length) return Promise.resolve();
    return list.reduce(function (chain, item, i) {
      return chain.then(function () {
        onItem && onItem(item, i);
        return say(item);
      });
    }, Promise.resolve());
  }

  /**
   * wait(ms) -- a pause that does NOT touch playback.
   * Needed between repeated prompts and between the feedback sound and the
   * next question, so nothing gets cancelled mid-sentence.
   */
  function wait(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms || 0); });
  }

  function init(generatedManifest) {
    manifest = generatedManifest || {};
    return manifest;
  }

  function setMuted(v) {
    muted = !!v;
    if (muted) stop();
  }

  function setVariant(name) {
    variant = name || 'default';
    // A pooled element may still be mid-load; drop them so nothing speaks
    // in the old voice by accident.
    pool.forEach(function (el) { try { el.pause(); } catch (e) { /* ignore */ } });
    pool = [];
    return variant;
  }

  return {
    init: init,
    has: has,
    count: function () { return Object.keys(manifest).length; },
    say: say,
    wait: wait,
    playSequence: playSequence,
    prefetch: prefetch,
    stop: stop,
    setMuted: setMuted,
    isMuted: function () { return muted; },
    setVariant: setVariant,
    getVariant: function () { return variant; },
    hasVariant: hasVariant,
    anyVariantHas: anyVariantHas,
    listVariants: listVariants,
    key: key
  };
})();
