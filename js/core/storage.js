/* =============================================================
   storage.js — tiny namespaced wrapper around localStorage.
   Every pupil gets one profile. Data is always defensive: a
   corrupt or missing entry must never break the game.
   ============================================================= */
window.LG = window.LG || {};

LG.Store = (function () {
  'use strict';

  var KEY = 'wordquest.v1';
  var memory = null;          // fallback when localStorage is unavailable
  var available = (function () {
    try {
      var t = '__wq_probe__';
      window.localStorage.setItem(t, '1');
      window.localStorage.removeItem(t);
      return true;
    } catch (e) {
      return false;           // e.g. private mode / file:// restrictions
    }
  })();

  function blank() {
    return {
      pupil: { name: '', created: 0 },
      /* Every persisted setting MUST be declared here. merge() copies only
         keys that already exist in this shape, so a setting added to the
         app but not to this list would be silently dropped on reload. */
      settings: { voiceURI: 'auto', rate: 0.9, repeats: 3, keyboard: false },
      topics: {},              // topicId -> { stars: {levelId: n}, best: {levelId: n} }
      badges: {},              // badgeId -> ISO date earned
      stats: { xp: 0, answered: 0, correct: 0, streakDays: 0, lastPlayed: '', perfectLevels: 0 }
    };
  }

  function read() {
    if (!available) return memory || (memory = blank());
    try {
      var raw = window.localStorage.getItem(KEY);
      if (!raw) return blank();
      return merge(blank(), JSON.parse(raw));
    } catch (e) {
      return blank();
    }
  }

  /* Shallow-per-key merge so a data-shape upgrade never wipes progress. */
  function merge(base, incoming) {
    if (!incoming || typeof incoming !== 'object') return base;
    Object.keys(base).forEach(function (k) {
      var v = incoming[k];
      if (v === undefined) return;
      if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
        base[k] = merge(base[k], v);
      } else {
        base[k] = v;
      }
    });
    return base;
  }

  function write(data) {
    if (!available) { memory = data; return; }
    try {
      window.localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) { /* quota or private mode — keep playing, just don't persist */ }
  }

  var cache = read();

  return {
    available: available,

    all: function () { return cache; },

    get: function (path, fallback) {
      var parts = path.split('.'), node = cache;
      for (var i = 0; i < parts.length; i++) {
        if (node === null || node === undefined) return fallback;
        node = node[parts[i]];
      }
      return node === undefined ? fallback : node;
    },

    set: function (path, value) {
      var parts = path.split('.'), node = cache;
      for (var i = 0; i < parts.length - 1; i++) {
        if (typeof node[parts[i]] !== 'object' || node[parts[i]] === null) {
          node[parts[i]] = {};
        }
        node = node[parts[i]];
      }
      node[parts[parts.length - 1]] = value;
      write(cache);
      return value;
    },

    topic: function (topicId) {
      if (!cache.topics[topicId]) {
        cache.topics[topicId] = { stars: {}, best: {} };
      }
      return cache.topics[topicId];
    },

    reset: function () {
      cache = blank();
      write(cache);
    }
  };
})();
