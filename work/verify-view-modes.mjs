import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as T from '../outputs/three.module.js';
import { ViewModes } from '../outputs/view-modes.js';
import { Observer } from '../outputs/observer.js';
import { GuidedView } from '../outputs/guided-view.js';
import { setupEclipseUI } from '../outputs/eclipse-ui.js';
import { setupMeteorShowerUI } from '../outputs/meteor-shower-ui.js';
const scope = { Date, Math };
vm.runInNewContext(fs.readFileSync('outputs/astronomy.browser.min.js', 'utf8'), scope);
globalThis.Astronomy = scope.Astronomy;
class Control extends EventTarget {
  constructor(type = '', value = '') {
    super();
    this.type = type;
    this.value = value;
    this.checked = false;
    this.attrs = {};
  }
  dispatchEvent(event) {
    this['on' + event.type]?.(event);
    return super.dispatchEvent(event);
  }
  getAttribute(name) {
    return this.attrs[name];
  }
  setAttribute(name, value) {
    this.attrs[name] = value;
  }
}
const html = fs.readFileSync('outputs/index.html', 'utf8');
const controls = Object.fromEntries([...html.matchAll(/\bid="([^"]+)"/g)].map(m => [m[1], new Control()]));
for (const id of ['observe', 'lines', 'nebula', 'names', 'constellationLabels'])
  controls[id].type = 'checkbox';
for (const [id, value] of Object.entries({
  journey: 'warp',
  speed: '.8',
  tourKind: 'winter',
  tourInterval: '30',
  fov: '65',
  starStyle: 'immersive',
  light: '1.5',
  artDisplay: 'off',
  artOpacity: '.28',
  date: '',
  timezone: '9',
  latitude: '35.68',
  longitude: '139.76',
  planetMode: 'off',
  timeFlow: '0',
  destination: 'core',
  meteorShower: 'auto',
}))
  controls[id].value = value;
controls.lines.checked = true;
controls.pause.setAttribute('aria-pressed', 'true');
globalThis.document = Object.assign(new EventTarget(), { getElementById: id => controls[id] });
const camera = new T.PerspectiveCamera(65);
const observer = new Observer(new T.Scene(), camera, () => {});
let stopCount = 0,
  goCount = 0,
  pose = { yaw: 1.2, pitch: -0.4, fov: 65, position: [2, 3, 4] };
const e = {
  camera,
  observer,
  currentDestination: 'core',
  target: { yaw: 2, pitch: 0.5, fov: 60 },
  routes: { core: [0, 0, 'Core', 'space'], c_test: [10, 45, 'Test', 'ground'] },
  constellationCenters: [{ id: 'test', vector: new T.Vector3(0, 1, 0) }],
  keys: new Set(['ArrowLeft']),
  tourTime: 12,
  tourIndex: 7,
  velocity: 40,
  forwardDirection: new T.Vector3(1, 2, 3),
  narrator: {
    stop() {
      stopCount++;
    },
  },
  focus: { enabled: true, restore() {} },
  cancelTurn() {
    this.target = null;
  },
  go(key) {
    goCount++;
    this.currentDestination = key;
    this.target = { yaw: 0.8, pitch: 0.6, fov: 65 };
  },
  lookAt(direction, fov) {
    this.target = { direction, fov };
  },
};
e.guide = new GuidedView(e);
e.guide.active = true;
e.guide.remaining = 3;
e.guide.frameShift = 0.3;
const planets = { mode: 'off', solarCamera: new T.PerspectiveCamera(55) };
controls.planetMode.onchange = () => {
  planets.mode = controls.planetMode.value;
  e.solarMode = planets.mode === 'solar';
};
const modes = new ViewModes(e, observer, planets, {
  capture: () => structuredClone(pose),
  restore: value => {
    pose = structuredClone(value);
    camera.fov = pose.fov;
    controls.fov.value = String(pose.fov);
  },
  setPaused: paused => controls.pause.setAttribute('aria-pressed', String(paused)),
});
observer.setView = view => modes.switch(view);
observer.prepareObservation = () => {
  modes.switch('observe');
  e.cancelTurn();
  e.guide.interrupt();
};
const spacePose = structuredClone(pose);
assert.equal(modes.switch('space'), false);
assert.equal(stopCount, 0, 'same view never interrupts narration');
assert.equal(modes.switch('observe'), true);
assert.equal(observer.active, true);
assert.equal(planets.mode, 'sky');
assert.equal(controls.journey.value, 'walk');
assert.equal(controls.speed.value, '0');
assert.equal(controls.timeFlow.value, '0');
assert.equal(
  controls.pause.getAttribute('aria-pressed'),
  'false',
  'paused space must not block ground navigation',
);
assert.ok(pose.pitch >= 0.3, 'initial ground view is above the horizon');
assert.equal(e.velocity, 0);
assert.equal(e.guide.remaining, 0);
assert.equal(e.guide.frameShift, 0);
assert.equal(e.keys.size, 0);
controls.timeFlow.value = '3600';
controls.timeFlow.onchange();
controls.lines.checked = false;
pose = { ...pose, yaw: -0.8, pitch: 0.7, fov: 42 };
controls.fov.value = '42';
const groundPose = structuredClone(pose);
assert.equal(modes.switch('solar'), true);
assert.equal(observer.active, false);
assert.equal(e.solarMode, true);
assert.equal(controls.timeFlow.value, '0', 'ground playback must not leak into solar');
controls.timePlay.onclick();
assert.equal(controls.timeFlow.value, '86400');
const date = +observer.date;
observer.update(1);
assert.equal(+observer.date, date + 86400000);
assert.equal(modes.switch('space'), true);
assert.deepEqual(pose, spacePose);
assert.equal(e.target, null, 'leaving a guided view must not resume its older steering target');
assert.equal(controls.journey.value, 'warp');
assert.equal(controls.speed.value, '.8');
assert.equal(controls.lines.checked, true);
assert.equal(controls.pause.getAttribute('aria-pressed'), 'true');
assert.equal(e.tourTime, 12);
assert.equal(e.tourIndex, 7);
assert.equal(controls.timeFlow.value, '0');
const frozen = +observer.date;
observer.update(60);
assert.equal(+observer.date, frozen, 'hidden observing clock stays still in space');
for (let i = 0; i < 12; i++) {
  modes.switch('observe');
  assert.deepEqual(pose, groundPose);
  assert.equal(controls.lines.checked, false);
  assert.equal(controls.timeFlow.value, '3600');
  assert.equal(
    modes.preferences().space.journey,
    'warp',
    'ground settings must not overwrite startup space preferences',
  );
  modes.switch('solar');
  assert.equal(controls.timeFlow.value, '86400');
  assert.equal(observer.active, false);
}
assert.equal(controls.atmosphere.checked, false, 'starry daytime preference is unchanged');
assert.ok(goCount <= 1, 'returning to a mode must not restart target selection');
const stops = stopCount;
assert.equal(modes.switch('unknown'), false);
assert.equal(modes.switch('solar'), false);
assert.equal(stopCount, stops);
// Entry points from solar must switch first, then keep their explicit date and paused clock.
const interval = globalThis.setInterval;
globalThis.setInterval = () => 0;
setupMeteorShowerUI(observer, () => {});
globalThis.setInterval = interval;
controls.showerJump.onclick();
assert.equal(modes.current, 'observe');
assert.equal(planets.mode, 'sky');
assert.equal(controls.timeFlow.value, '0');
assert.equal(controls.date.value.slice(11, 16), '02:00');
modes.switch('solar');
observer.setDate(new Date('2024-03-01T00:00:00Z'));
controls.latitude.value = '32.7767';
controls.longitude.value = '-96.797';
let environmentUpdated = false;
const environment = {
  update() {
    environmentUpdated = true;
  },
  sunDirection() {
    assert.ok(environmentUpdated);
    return new T.Vector3(0, 1, 0);
  },
};
setupEclipseUI(observer, environment, e, () => {});
controls.nextSolarEclipse.onclick();
assert.equal(modes.current, 'observe');
assert.equal(controls.timeFlow.value, '0');
assert.ok(Math.abs(+observer.date - +new Date('2024-04-08T18:42:00Z')) < 360000);
assert.equal(e.target.fov, 10, 'eclipse view is framed synchronously, without a stale delayed turn');
modes.switch('solar');
assert.equal(e.target, null);
console.log(
  'Mode round trips, isolated settings, pause/clock restoration, framing cancellation, and event entry points: PASS',
);
