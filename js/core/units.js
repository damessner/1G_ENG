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

  return {
    register: register,
    find: find,
    place: place,
    grouped: grouped,
    totalStars: totalStars,
    all: function () { return units; }
  };
})();
