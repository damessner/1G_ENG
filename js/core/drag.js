/* =============================================================
   drag.js — one pointer-based drag engine, shared by every drag
   interaction in the game (match, sort, order).

   Why not HTML5 drag and drop: it does not work on touch screens,
   which is most of the class. Pointer events cover mouse, touch and
   stylus with one code path.

   Why there is also a tap-to-place fallback: dragging a small tile
   across a tablet is fiddly, and a pupil who cannot drag should not
   be locked out of the exercise. Tap a piece, then tap a target.
   Both routes call the same onDrop.
   ============================================================= */
window.LG = window.LG || {};

LG.Drag = (function () {
  'use strict';

  var THRESHOLD = 8;          // px of movement before a drag begins
  var selected = null;        // the piece picked up by tap

  function clearSelection() {
    if (selected) selected.el.classList.remove('is-selected');
    selected = null;
  }

  function findZone(x, y, zoneSelector) {
    var under = document.elementFromPoint(x, y);
    if (!under) return null;
    return under.closest(zoneSelector);
  }

  function makeGhost(el, x, y) {
    var r = el.getBoundingClientRect();
    var ghost = el.cloneNode(true);
    ghost.className = el.className + ' is-ghost';
    ghost.style.position = 'fixed';
    ghost.style.left = '0px';
    ghost.style.top = '0px';
    ghost.style.width = r.width + 'px';
    ghost.style.height = r.height + 'px';
    ghost.style.pointerEvents = 'none';
    ghost.style.zIndex = '90';
    document.body.appendChild(ghost);
    return { node: ghost, dx: x - r.left, dy: y - r.top };
  }

  /**
   * enable(el, opts)
   *   opts.zoneSelector  where it may be dropped
   *   opts.onDrop(el, zone)  return true to accept
   *   opts.handleSelector   optional: only this part starts a drag
   */
  function enable(el, opts) {
    opts = opts || {};
    var zoneSelector = opts.zoneSelector || '.drop-zone';
    var ghost = null;
    var startX = 0, startY = 0, dragging = false, pointerId = null;
    var originParent = el.parentNode;
    var originNext = el.nextSibling;

    function onDown(e) {
      if (el.dataset.placed === 'true') return;
      if (e.button != null && e.button !== 0) return;
      startX = e.clientX; startY = e.clientY;
      dragging = false; pointerId = e.pointerId;
      // Capture can throw when there is no active pointer for this id
      // (synthetic events, or a pointer already released). It is an
      // optimisation, not a requirement, so never let it break the drag.
      try {
        if (el.setPointerCapture) el.setPointerCapture(e.pointerId);
      } catch (err) { /* not capturable; window listeners still work */ }
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    }

    function onMove(e) {
      if (e.pointerId !== pointerId) return;
      var dx = e.clientX - startX, dy = e.clientY - startY;
      if (!dragging && Math.sqrt(dx * dx + dy * dy) < THRESHOLD) return;
      if (!dragging) {
        dragging = true;
        clearSelection();
        el.classList.add('is-dragging');
        ghost = makeGhost(el, e.clientX, e.clientY);
      }
      if (ghost) {
        ghost.node.style.transform =
          'translate(' + (e.clientX - ghost.dx) + 'px,' + (e.clientY - ghost.dy) + 'px) scale(1.05)';
      }
      e.preventDefault();
    }

    function onUp(e) {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      if (ghost && ghost.node) ghost.node.remove();
      ghost = null;
      el.classList.remove('is-dragging');
      if (e.pointerId !== pointerId) return;
      pointerId = null;

      if (!dragging) {
        // A tap, not a drag. Two cases:
        //   tap a piece      -> select it
        //   tap a target     -> place whatever is selected
        // The piece to place is the SELECTED one, not the element that
        // received the tap: tapping a target means the target is the
        // element under the finger, not the thing being moved.
        var zone = findZone(e.clientX, e.clientY, zoneSelector);
        // Ignore the piece's own container: a tray is often itself a drop
        // zone, and without this a rejected drop leaves the piece tapping
        // "into the tray" forever instead of re-selecting.
        if (zone && zone !== el.parentNode) {
          if (selected) tryPlace(selected.el, zone);
          return;
        }
        // Tapping a piece that is already selected keeps it selected. A
        // rejected drop leaves the piece selected on purpose, and
        // deselecting here would silently throw away the pupil's choice
        // and make the next tap do nothing.
        if (selected && selected.el === el) return;
        clearSelection();
        el.classList.add('is-selected');
        selected = { el: el };
        return;
      }

      var target = findZone(e.clientX, e.clientY, zoneSelector);
      if (target) tryPlace(el, target);
      else {                                   // dropped in the wrong place
        el.animate
          ? el.animate([{ transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' },
                        { transform: 'translateX(0)' }], { duration: 180 })
          : null;
      }
    }

    function tryPlace(piece, zone) {
      if (opts.onDrop && opts.onDrop(piece, zone) === false) {
        piece.animate
          ? piece.animate([{ transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' },
                           { transform: 'translateX(0)' }], { duration: 180 })
          : null;
        return;
      }
      zone.appendChild(piece);
      piece.dataset.placed = 'true';
      piece.classList.remove('is-selected');
      clearSelection();
      if (piece.setPointerCapture && pointerId != null) {
        try { piece.releasePointerCapture(pointerId); } catch (err) { /* already gone */ }
      }
    }

    el.addEventListener('pointerdown', onDown);
    el.classList.add('is-draggable');
    /* Expose the placement routine so a drop zone can invoke it when the
       pupil taps a target instead of dragging onto it. The zone has no
       drag listener of its own, so without this the tap route is dead. */
    el.lgPlace = function (zone) { tryPlace(el, zone); };

    return function disable() {
      el.removeEventListener('pointerdown', onDown);
      el.classList.remove('is-draggable');
    };
  }

  /**
   * makeTarget(el, opts) — turn a drop zone into a tap target as well, so
   * "tap a piece, then tap where it goes" works. Pieces are draggable and
   * targets are tappable; both routes end in the same onDrop.
   */
  function makeTarget(el, opts) {
    opts = opts || {};
    var zoneSelector = opts.zoneSelector || '.drop-zone';

    function onTargetDown(e) {
      if (!selected) return;
      if (e.button != null && e.button !== 0) return;
      var zone = findZone(e.clientX, e.clientY, zoneSelector);
      if (!zone) return;
      e.preventDefault();
      e.stopPropagation();
      if (selected.el && selected.el.lgPlace) selected.el.lgPlace(zone);
    }

    el.addEventListener('pointerdown', onTargetDown);
    return function untarget() {
      el.removeEventListener('pointerdown', onTargetDown);
    };
  }

  return {
    enable: enable,
    makeTarget: makeTarget,
    clearSelection: clearSelection,
    THRESHOLD: THRESHOLD
  };
})();
