import assert from 'node:assert/strict';
import * as T from '../outputs/three.module.js';
import { GuidedView } from '../outputs/guided-view.js';
import { Observer } from '../outputs/observer.js';
const camera = new T.PerspectiveCamera(55, 16 / 9);
const guide = new GuidedView({ camera });
guide.active = true;
guide.savedFov = 65;
guide.frameShift = 0.2;
guide.remaining = 3;
guide.interrupt();
camera.fov = 31;
guide.update(camera, 0.05);
assert.equal(camera.fov, 31);
assert.equal(guide.active, false);
assert.equal(guide.remaining, 0);
assert.equal(camera.projectionMatrix.elements[9], 0);
const controls = Object.fromEntries(
  [
    'observe',
    'latitude',
    'longitude',
    'timePlay',
    'timeFlow',
    'date',
    'timezone',
    'now',
    'season',
    'locate',
    'searchAddress',
    'locations',
    'planetMode',
  ].map(id => [
    id,
    {
      value: '0',
      checked: false,
      dispatchEvent() {
        this.onchange?.();
      },
    },
  ]),
);
controls.timezone.value = '9';
controls.planetMode.value = 'off';
globalThis.document = { getElementById: id => controls[id] };
const notices = [];
const observer = new Observer(new T.Scene(), camera, x => notices.push(x));
const instant = +observer.date;
controls.date.value = '';
observer.readDate();
assert.equal(+observer.date, instant);
assert(controls.date.value.includes('T'));
assert.equal(notices.length, 1);
controls.timezone.value = '-5';
controls.timezone.onchange();
assert.equal(+observer.date, instant);
assert.equal(controls.date.value, new Date(instant - 5 * 3600000).toISOString().slice(0, 19));
controls.timeFlow.value = '3600';
controls.timeFlow.onchange();
assert.equal(observer.active, false);
observer.update(1);
assert.equal(+observer.date, instant);
assert.equal(observer.flowBeforePause, 3600);
console.log(
  'Manual zoom remains stable; invalid dates recover; timezone preserves instant; hidden time-flow does not change modes or advance time: PASS',
);
