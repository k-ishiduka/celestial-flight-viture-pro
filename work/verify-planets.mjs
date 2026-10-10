import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const scope = { Date, Math };
vm.runInNewContext(fs.readFileSync('outputs/astronomy.browser.min.js', 'utf8'), scope);
globalThis.Astronomy = scope.Astronomy;
const { planetData, helioPosition } = await import('../outputs/planets.js');
const date = new Date('2026-10-06T12:00:00Z');
for (const [body, name] of planetData) {
  let p = helioPosition(body, date),
    q = helioPosition(body, new Date(+date + 86400000));
  assert(p.toArray().every(Number.isFinite));
  assert(p.distanceTo(q) > 0);
  let axis = scope.Astronomy.RotationAxis(body, date);
  assert(Number.isFinite(axis.spin));
  console.log(name, p.length().toFixed(3) + ' AU');
}
console.log('All 8 planets: dated positions, orbital movement and spin PASS');
