import assert from 'node:assert/strict';
import * as T from '../outputs/three.module.js';
import { SkyGesture, pickingViewport, pickConstellation, pickPlanet } from '../outputs/sky-picking.js';
import { SkyInterface } from '../outputs/interface.js';
const camera = new T.PerspectiveCamera(60, 2, 0.1, 30000);
camera.position.set(30, 20, 10);
camera.updateMatrixWorld();
const geometry = coords =>
  new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute(coords, 3));
const e = {
  camera,
  constellationCenters: [{ id: 'Center' }, { id: 'Right' }, { id: 'Behind' }, { id: 'Below' }],
  constellationAtlas: {
    Center: { geometry: geometry([-200, 0, -1000, 200, 0, -1000]) },
    Right: { geometry: geometry([500, 100, -1000, 700, 100, -1000]) },
    Behind: { geometry: geometry([-1000, 0, 1000, 1000, 0, 1000]) },
    Below: { geometry: geometry([-100, -400, -1000, 100, -400, -1000]) },
  },
  observer: { active: false, vector: v => v.clone() },
};
const bounds = { left: 40, top: 70, width: 1000, height: 500 };
const at = (local, viewCamera = camera, half = null) => {
  const p = local.clone().add(camera.position).project(viewCamera);
  const w = bounds.width / (half === null ? 1 : 2);
  return {
    x: bounds.left + (half || 0) * w + ((p.x + 1) * w) / 2,
    y: bounds.top + ((1 - p.y) * bounds.height) / 2,
  };
};
const right = at(new T.Vector3(600, 100, -1000));
assert.equal(
  pickConstellation(pickingViewport(right.x, right.y, bounds, camera), e).id,
  'Right',
  'click location wins over the constellation at the center',
);
assert.equal(pickConstellation(pickingViewport(540, 320, bounds, camera), e).id, 'Center');
assert.equal(
  pickConstellation(pickingViewport(41, 71, bounds, camera), e),
  null,
  'empty sky never selects a distant constellation',
);
assert.equal(pickingViewport(1, 1, bounds, camera), null);
e.observer.active = true;
const below = at(new T.Vector3(0, -400, -1000));
assert.equal(
  pickConstellation(pickingViewport(below.x, below.y, bounds, camera), e),
  null,
  'ground blocks selection below the horizon',
);
e.observer.active = false;
// The same apparent constellation is hit in either eye, including off-axis guide framing.
camera.projectionMatrix.elements[9] = -0.15;
camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
const stereo = new T.StereoCamera();
stereo.aspect = 1;
stereo.update(camera);
for (const [half, eye] of [
  [0, stereo.cameraL],
  [1, stereo.cameraR],
]) {
  eye.projectionMatrix.elements[9] = -0.15;
  eye.matrixWorldInverse.copy(eye.matrixWorld).invert();
  const point = at(new T.Vector3(600, 100, -1000), eye, half);
  const view = pickingViewport(point.x, point.y, bounds, camera, stereo);
  assert.equal(view.camera, eye);
  assert.equal(pickConstellation(view, e).id, 'Right');
}
// Label sprites are directly selectable even with line geometry unavailable.
camera.updateProjectionMatrix();
const labels = new T.Group();
labels.position.copy(camera.position);
const label = new T.Sprite(new T.SpriteMaterial({ sizeAttenuation: false }));
label.position.set(500, 200, -1000);
label.scale.set(0.18, 0.045, 1);
label.userData.constellationID = 'Right';
labels.add(label);
e.constellationNames = labels;
labels.updateMatrixWorld(true);
const labelPoint = at(label.position);
assert.equal(pickConstellation(pickingViewport(labelPoint.x, labelPoint.y, bounds, camera), e).id, 'Right');
// Ground transforms must be applied before projecting the selected line.
e.constellationNames = null;
e.observer.vector = v => v.clone().applyAxisAngle(new T.Vector3(0, 1, 0), 0.4);
const transformed = at(e.observer.vector(new T.Vector3(600, 100, -1000)));
assert.equal(pickConstellation(pickingViewport(transformed.x, transformed.y, bounds, camera), e).id, 'Right');
const solarScene = new T.Scene();
const mesh = new T.Mesh(new T.SphereGeometry(40), new T.MeshBasicMaterial());
mesh.position.copy(camera.position).add(new T.Vector3(0, 0, -500));
solarScene.add(mesh);
const text = new T.Sprite(new T.SpriteMaterial());
text.position.set(10000, 10000, 10000);
solarScene.add(text);
const planet = { body: 'Earth', mesh, text };
assert.equal(
  pickPlanet(pickingViewport(540, 320, bounds, camera), { solarScene, objects: [planet] }),
  planet,
);
const gesture = new SkyGesture();
const pointer = (id = 1, x = 100, y = 100, at = 100, button = 0) => ({
  pointerId: id,
  clientX: x,
  clientY: y,
  timeStamp: at,
  button,
});
gesture.down(pointer());
assert.equal(gesture.up(pointer(1, 103, 102, 200)), true);
gesture.down(pointer());
gesture.move(pointer(1, 130));
gesture.move(pointer());
assert.equal(gesture.up(pointer(1, 100, 100, 200)), false, 'a drag returning to its origin is still a drag');
gesture.down(pointer());
assert.equal(gesture.up(pointer(1, 100, 100, 900)), false, 'long press is not selection');
gesture.down(pointer(1, 100, 100, 100, 2));
assert.equal(gesture.up(pointer()), false);
gesture.down(pointer());
gesture.down(pointer(2));
assert.equal(gesture.up(pointer(1)), false);
assert.equal(gesture.up(pointer(2)), false);
gesture.down(pointer());
gesture.cancel(pointer());
assert.equal(gesture.up(pointer()), false);
assert.equal(gesture.pointers.size, 0);
// Each action uses the explicit selected target, including a non-central constellation.
const controls = {
  tourKind: { value: 'winter' },
  artDisplay: { value: 'off', dispatchEvent() {} },
  planetTarget: { value: 'all', dispatchEvent() {} },
};
globalThis.document = { getElementById: id => controls[id] };
const selected = { key: 'c_Right', route: [30, 10, '右の星座', ''] };
const calls = [];
const experience = {
  prepareNavigation() {},
  tourKeys: () => ['c_Center', 'c_Right', 'c_Other'],
  narrator: { say: (...args) => calls.push(['say', ...args]) },
  guide: { lock: (...args) => calls.push(['lock', ...args]) },
};
const ui = Object.assign(Object.create(SkyInterface.prototype), {
  selectedTarget: selected,
  selectedID: 'Right',
  e: experience,
  closePanel() {},
  modes: { pilot: { setPaused: paused => calls.push(['paused', paused]) } },
});
ui.actOnSelection('speak');
assert.equal(calls.at(-1)[1], 'c_Right');
ui.actOnSelection('zoom');
assert.equal(calls.at(-1)[1], 'Right');
ui.actOnSelection('tour');
assert.equal(experience.tourIndex, 1);
assert.equal(experience.narrator.enabled, true);
assert.equal(controls.tourKind.value, 'all');
ui.actOnSelection('art');
assert.equal(controls.artDisplay.value, 'always');
ui.selectedTarget = { planet };
ui.actOnSelection('zoom');
assert.equal(controls.planetTarget.value, 'Earth');
ui.actOnSelection('overview');
assert.equal(controls.planetTarget.value, 'all');
console.log(
  'Screen-position selection, ground masking, SBS eyes, labels, planets, gesture rejection, and selected-target actions: PASS',
);

ui.selectionPoint = { x: 500, y: 300, at: performance.now() };
assert.ok(
  ui.isRepeatedSelection({ detail: 1, clientX: 500, clientY: 300 }),
  'the second half of a double click must not activate a newly opened menu',
);
assert.ok(!ui.isRepeatedSelection({ detail: 0 }), 'keyboard activation is immediate');
assert.ok(
  !ui.isRepeatedSelection({ detail: 1, clientX: 600, clientY: 300 }),
  'a deliberate click on another action is immediate',
);
