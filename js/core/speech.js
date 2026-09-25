/* =============================================================
   speech.js — Web Speech synthesis. This is the FALLBACK engine.

   The game prefers pre-rendered MP3s (js/core/audio.js) because they
   sound identical everywhere and work with no voice installed. This
   file only takes over when a clip is missing from the manifest, so
   a half-built audio pack still produces a playable game.
   ============================================================= */
window.LG = window.LG || {};

LG.Speech = (function () {
  'use strict';

  var synth = window.speechSynthesis || null;
  var supported = !!synth;
  var voices = [];
  var chosen = null;

  /* Synthetic-phonics approximations, used when a topic asks for a
     letter sound and no rendered clip exists. Mirrors data/vocab.json. */
  var FALLBACK_SOUNDS = {
    b: 'buh', c: 'kuh', d: 'duh', f: 'ff', g: 'guh', h: 'huh', j: 'juh',
    k: 'kuh', l: 'll', m: 'mm', n: 'nn', p: 'puh', q: 'kwuh', r: 'rr',
    s: 'ss', t: 'tuh', v: 'vv', w: 'wuh', x: 'ks', y: 'yuh', z: 'zz'
  };

  function pickVoice() {
    if (!voices.length) return;
    var want = LG.Store.get('settings.voiceURI', 'auto');
    if (want && want !== 'auto') {
      for (var i = 0; i < voices.length; i++) {
        if (voices[i].voiceURI === want) { chosen = voices[i]; return; }
      }
    }
    var pref = [/Sonia/i, /Samantha/i, /Karen/i, /Google UK English Female/i, /Aria/i];
    for (var p = 0; p < pref.length; p++) {
      for (var j = 0; j < voices.length; j++) {
        if (pref[p].test(voices[j].name)) { chosen = voices[j]; return; }
      }
    }
    for (var k = 0; k < voices.length; k++) {
      if (/^en[-_]GB/i.test(voices[k].lang)) { chosen = voices[k]; return; }
    }
    for (var m = 0; m < voices.length; m++) {
      if (/^en/i.test(voices[m].lang)) { chosen = voices[m]; return; }
    }
  }

  function loadVoices() {
    if (!synth) return;
    try { voices = synth.getVoices() || []; } catch (e) { voices = []; }
    pickVoice();
  }

  if (synth) {
    loadVoices();
    if (typeof synth.addEventListener === 'function') {
      synth.addEventListener('voiceschanged', loadVoices);
    }
    // Chrome silently suspends synthesis after ~15s; nudge it awake.
    setInterval(function () {
      if (synth.speaking && !synth.paused) { synth.pause(); synth.resume(); }
    }, 9000);
  }

  function utter(text, opts) {
    opts = opts || {};
    var u = new SpeechSynthesisUtterance(text);
    u.lang = (chosen && chosen.lang) || 'en-GB';
    if (chosen) u.voice = chosen;
    u.rate = opts.rate != null ? opts.rate : LG.Store.get('settings.rate', 0.9);
    u.pitch = opts.pitch != null ? opts.pitch : 1;
    u.volume = opts.volume != null ? opts.volume : 1;
    return u;
  }

  function say(text, opts) {
    if (!supported || !text) return Promise.resolve();
    try { synth.cancel(); } catch (e) { /* ignore */ }
    return new Promise(function (resolve) {
      var u = utter(String(text), opts);
      var done = false;
      function finish() { if (!done) { done = true; resolve(); } }
      u.onend = finish;
      u.onerror = finish;
      try { synth.speak(u); } catch (e) { finish(); }
      // Safety net: some engines never fire onend.
      setTimeout(finish, 1200 + String(text).length * 120);
    });
  }

  /* Fire a sequence of short items in order, calling back before each one
     so the UI can highlight the matching letter while it is spoken. */
  function saySequence(items, onItem, opts) {
    var list = (items || []).slice();
    if (!supported) { list.forEach(function (t) { onItem && onItem(t, 0); }); return Promise.resolve(); }
    try { synth.cancel(); } catch (e) { /* ignore */ }
    return list.reduce(function (chain, item, i) {
      return chain.then(function () {
        onItem && onItem(item, i);
        return say(typeof item === 'string' ? item : item.text, opts);
      });
    }, Promise.resolve());
  }

  function letterSound(ch) {
    return FALLBACK_SOUNDS[String(ch).toLowerCase()] || String(ch);
  }

  function stop() { if (supported) { try { synth.cancel(); } catch (e) { /* ignore */ } } }

  return {
    supported: supported,
    say: say,
    saySequence: saySequence,
    letterSound: letterSound,
    stop: stop,
    get voice() { return chosen; },
    listVoices: function () {
      return voices.filter(function (v) { return /^en/i.test(v.lang); });
    },
    refresh: loadVoices
  };
})();
