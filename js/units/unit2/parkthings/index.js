/* Topic shell for the wildlife-park things pack. */
window.LG = window.LG || {};

LG.registerTopic({
  id: 'parkthings',
  unit: 'unit2',
  name: 'In the Park',
  tagline: 'Trees, rocks, bridges and ponds',
  icon: '\uD83C\uDF33',           // 🌳
  color: '#65a30d',
  soft: '#f7fee7',
  levels: LG._pending.parkthings || []
});
