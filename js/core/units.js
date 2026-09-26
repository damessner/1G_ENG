/* =============================================================
   units.js — the syllabus layer.

   A unit is a folder. A topic is a folder inside it. A level is one
   entry in that topic's levels.js. Nothing above this file knows what
   "Unit 1" or "Alphabet" mean; they are just names and ordering, which
   is what makes Unit 2 a copy-paste rather than a refactor.
   ============================================================= */
window.LG = window.LG || {};

LG.Units = (function () {
  'use strict';

  var units = [];

  function register(unit) {
    unit.topics = [];
    units.push(unit);
    return unit;
  }

  function find(id) {
    for (var i = 0; i < units.length; i++) {
      if (units[i].id === id) return units[i];
    }
    return null;
  }

  /* Attach a topic to its unit, declared as `unit: 'unit1'` on the topic.
     A topic with no unit is collected into an implicit "Other" bucket so a
     half-finished pack still appears rather than vanishing from the menu. */
  function place(topic) {
    var u = find(topic.unit);
    if (!u) {
      u = find('other') || register({ id: 'other', number: '', name: 'Other', accent: '#94a3b8' });
    }
    u.topics.push(topic);
    return topic;
  }

  /* Topics in the order they were registered, grouped by unit. Used by the
     home screen so the menu mirrors the syllabus. */
  function grouped() {
    return units.filter(function (u) { return u.topics.length > 0; })
      .map(function (u) {
        return {
          id: u.id,
          number: u.number,
          name: u.name,
          tagline: u.tagline,
          accent: u.accent,
          icon: u.icon,
          topics: u.topics,
          stars: u.topics.reduce(function (sum, t) {
            return sum + LG.Game.topicStars(t.id);
          }, 0),
          maxStars: u.topics.reduce(function (sum, t) { return sum + t.levels.length * 3; }, 0)
        };
      });
  }

  function totalStars() {
    return LG.topics.reduce(function (s, t) { return s + LG.Game.topicStars(t.id); }, 0);
  }

  /* ---------------- progressive unlocking ----------------
     Topics run in syllabus order across every unit. A topic opens once the
     one before it has been played properly: 2 stars or better on *every*
     level, not a running total. A total can be met by grinding one level
     and skipping the rest, which is exactly what we do not want. */
  var UNLOCK_STARS = 2;

  function orderedTopics() {
    var out = [];
    units.forEach(function (u) {
      u.topics.forEach(function (t) { out.push(t); });
    });
    return out;
  }

  /* topicId -> { unlocked, prev, need, have, mastered, stars, maxStars } */
  function unlockMap() {
    var list = orderedTopics();
    var map = {};
    var override = !!LG.Store.get('settings.unlockAll', false);

    list.forEach(function (t, i) {
      var stars = LG.Game.topicStars(t.id);
      var maxStars = t.levels.length * 3;
      var mastered = t.levels.every(function (lv) {
        return (LG.Store.get('topics.' + t.id + '.stars.' + lv.id, 0) || 0) >= 3;
      });

      if (i === 0) {
        map[t.id] = { unlocked: true, prev: null, need: 0, have: 0,
                      mastered: mastered, stars: stars, maxStars: maxStars };
        return;
      }
      var prev = list[i - 1];
      var need = prev.levels.length;
      var have = prev.levels.filter(function (lv) {
        return (LG.Store.get('topics.' + prev.id + '.stars.' + lv.id, 0) || 0) >= UNLOCK_STARS;
      }).length;
      map[t.id] = {
        unlocked: override || have >= need,
        prev: prev, need: need, have: have,
        mastered: mastered, stars: stars, maxStars: maxStars
      };
    });
    return map;
  }

  /* What to render for a unit: everything up to and including the first
     locked topic. Beyond that they are simply not shown yet, so a pupil
     sees the next goal without being handed the whole syllabus. */
  function visibleIn(unit) {
    var map = unlockMap();
    var out = [];
    var stopped = false;
    unit.topics.forEach(function (t) {
      if (stopped) return;
      var st = map[t.id] || { unlocked: true, mastered: false, stars: 0, maxStars: 0 };
      out.push({ topic: t, state: st });
      if (!st.unlocked) stopped = true;
    });
    return out;
  }

  return {
    register: register,
    find: find,
    place: place,
    grouped: grouped,
    totalStars: totalStars,
    all: function () { return units; },
    UNLOCK_STARS: UNLOCK_STARS,
    orderedTopics: orderedTopics,
    unlockMap: unlockMap,
    visibleIn: visibleIn
  };
})();
